import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { debug } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, "percobot.db"));

// Activer le mode WAL pour de meilleures performances en écriture concurrente
db.pragma("journal_mode = WAL");

export function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS combats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id TEXT NOT NULL,
      type TEXT NOT NULL,
      role TEXT NOT NULL,
      resultat TEXT NOT NULL,
      ennemis INTEGER NOT NULL,
      allies TEXT NOT NULL,
      alliance_focus INTEGER NOT NULL DEFAULT 0,
      screen1_url TEXT,
      screen2_url TEXT,
      validated_by TEXT,
      validated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      combat_id INTEGER NOT NULL,
      points REAL NOT NULL,
      semaine TEXT NOT NULL,
      FOREIGN KEY (combat_id) REFERENCES combats(id)
    );
  `);

  // Insérer les valeurs par défaut si la table config est vide
  const count = db.prepare("SELECT COUNT(*) as c FROM config").get().c;
  if (count === 0) {
    const defaults = {
      points_victoire: 10,
      points_defaite: 3,
      bonus_defense: 1.5,
      bonus_alliance_focus: 2,
      multi_egal: 1, // égalité ou supériorité numérique
      multi_moins1: 1.5, // -1 allié
      multi_moins2: 2, // -2 alliés
      multi_moins3: 3, // -3 alliés
      multi_moins4: 5, // seul contre ou 5
      multi_plus1: 0.8, // +1 allié
      multi_plus2: 0.5, // +2 alliés
      multi_plus3: 0.3, // +3 alliés
      multi_plus4: 0.1, // +4 alliés
    };

    const insert = db.prepare("INSERT INTO config (key, value) VALUES (?, ?)");
    const insertMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        insert.run(key, value);
      }
    });
    insertMany(Object.entries(defaults));
  }
}

// Récupérer toute la config
export function getConfig() {
  const rows = db.prepare("SELECT key, value FROM config").all();
  const config = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

// Modifier une valeur de config
export function setConfig(key, value) {
  return db
    .prepare("UPDATE config SET value = ? WHERE key = ?")
    .run(value, key);
}

// Obtenir la semaine courante (format ISO : "2026-W11")
export function getCurrentWeek() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - jan1) / 86400000);
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Calculer les points d'un combat
export function calculatePoints(
  config,
  resultat,
  role,
  allyCount,
  enemyCount,
  allianceFocus,
) {
  // Points de base
  const base =
    resultat === "Victoire" ? config.points_victoire : config.points_defaite;

  // Multiplicateur d'infériorité numérique
  const diff = allyCount - enemyCount;
  let multi;
  debug(
    `Calcul points : résultat=${resultat}, rôle=${role}, alliés=${allyCount}, ennemis=${enemyCount}, focus=${allianceFocus}`,
  );
  switch (diff) {
    case diff > 0:
      multi = config[`multi_plus${diff}`];
      break;
    case diff < 0:
      multi = config[`multi_moins${-diff}`];
    default:
      multi = config.multi_egal;
      break;
  }

  // Bonus défense
  const defBonus = role === "Défense" ? config.bonus_defense : 1;

  // Bonus alliance focus
  const focusBonus = allianceFocus ? config.bonus_alliance_focus : 1;

  return base * multi * defBonus * focusBonus;
}

// Enregistrer un combat
export function insertCombat({
  reporterId,
  type,
  role,
  resultat,
  ennemis,
  allies,
  allianceFocus,
  screen1Url,
  screen2Url,
}) {
  const stmt = db.prepare(`
    INSERT INTO combats (reporter_id, type, role, resultat, ennemis, allies, alliance_focus, screen1_url, screen2_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    reporterId,
    type,
    role,
    resultat,
    ennemis,
    allies,
    allianceFocus ? 1 : 0,
    screen1Url,
    screen2Url,
  );
}

// Valider un combat et attribuer les points
export function validateCombat(combatId, validatorId, allyIds) {
  const combat = db.prepare("SELECT * FROM combats WHERE id = ?").get(combatId);
  if (!combat) return null;

  const config = getConfig();
  const points = calculatePoints(
    config,
    combat.resultat,
    combat.role,
    allyIds.length,
    combat.ennemis,
    combat.alliance_focus === 1,
  );

  const semaine = getCurrentWeek();

  const transaction = db.transaction(() => {
    // Marquer le combat comme validé
    db.prepare(
      "UPDATE combats SET validated_by = ?, validated_at = datetime('now') WHERE id = ?",
    ).run(validatorId, combatId);

    // Ajouter les points pour chaque allié
    const insertScore = db.prepare(
      "INSERT INTO scores (user_id, combat_id, points, semaine) VALUES (?, ?, ?, ?)",
    );
    for (const allyId of allyIds) {
      insertScore.run(allyId, combatId, points, semaine);
    }
  });

  transaction();

  return { points, combat };
}

// Récupérer le ladder de la semaine courante
export function getLadder() {
  const semaine = getCurrentWeek();
  return db
    .prepare(
      `
    SELECT user_id, SUM(points) as total_points, COUNT(*) as combats
    FROM scores
    WHERE semaine = ?
    GROUP BY user_id
    ORDER BY total_points DESC
  `,
    )
    .all(semaine);
}

// Statistiques d'un joueur pour la semaine courante
export function getPlayerStats(userId) {
  const semaine = getCurrentWeek();
  return db
    .prepare(
      `
    SELECT
      SUM(s.points) as total_points,
      COUNT(s.id) as combats,
      SUM(CASE WHEN c.resultat = 'Victoire' THEN 1 ELSE 0 END) as victoires,
      SUM(CASE WHEN c.resultat = 'Défaite' THEN 1 ELSE 0 END) as defaites
    FROM scores s
    JOIN combats c ON s.combat_id = c.id
    WHERE s.user_id = ? AND s.semaine = ?
  `,
    )
    .get(userId, semaine);
}

// Reset hebdomadaire : retourne le top 3 puis purge les scores
export function weeklyReset() {
  const semaine = getCurrentWeek();
  const top = db
    .prepare(
      `
    SELECT user_id, SUM(points) as total_points
    FROM scores
    WHERE semaine = ?
    GROUP BY user_id
    ORDER BY total_points DESC
    LIMIT 3
  `,
    )
    .all(semaine);

  db.prepare("DELETE FROM scores WHERE semaine = ?").run(semaine);

  return top;
}

// Reset total (commande admin) : purge TOUS les scores
export function fullReset() {
  db.prepare("DELETE FROM scores").run();
}
