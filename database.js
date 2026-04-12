import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { debug } from "./logger.js";
import { EmbedBuilder } from "discord.js";

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

  // Insérer les valeurs par défaut s'il manque des clés

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
    multiplicateur_perco: 1, // multi perco
    multiplicateur_prisme: 1.3, // multi prisme
  };

  const insert = db.prepare(
    "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
  );
  const insertMany = db.transaction((entries) => {
    for (const [key, value] of entries) {
      insert.run(key, value);
    }
  });
  insertMany(Object.entries(defaults));
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

// Obtenir la semaine courante (format ISO 8601 : "2026-W11", semaine commence le lundi)
export function getCurrentWeek() {
  const now = new Date();
  const thu = new Date(now);
  thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
  const year = thu.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const weekNum =
    1 +
    Math.round(((thu - jan1) / 86400000 - 3 + ((jan1.getDay() + 6) % 7)) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

// Obtenir la paire de semaines pour le ladder (W13+W14, W15+W16, etc.)
export function getLadderWeeks() {
  const currentWeek = getCurrentWeek();
  const [year, week] = currentWeek.split("-W");
  const weekNum = parseInt(week);

  // Déterminer le début de la paire (semaine impaire)
  const pairStart = Math.floor((weekNum - 1) / 2) * 2 + 1;
  const pairEnd = pairStart + 1;

  return [
    `${year}-W${String(pairStart).padStart(2, "0")}`,
    `${year}-W${String(pairEnd).padStart(2, "0")}`,
  ];
}

// Calculer les points d'un combat
export function calculatePoints(
  type,
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
  if (diff > 0) {
    multi = config[`multi_plus${diff}`];
  } else if (diff < 0) {
    multi = resultat === "Victoire" ? config[`multi_moins${-diff}`] : 1;
  } else {
    multi = config.multi_egal;
  }

  // Bonus défense
  const defBonus = role === "Défense" ? config.bonus_defense : 1;

  // Bonus alliance focus
  const focusBonus = allianceFocus ? config.bonus_alliance_focus : 1;

  const typeMulti =
    type === "Prisme"
      ? config.multiplicateur_prisme
      : config.multiplicateur_perco;
  return (
    Math.round(base * defBonus * focusBonus * multi * (typeMulti || 1) * 100) /
    100
  );
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

// Récupérer un combat par son ID
export function getCombat(combatId) {
  return db.prepare("SELECT * FROM combats WHERE id = ?").get(combatId);
}

// Valider un combat et attribuer les points
export function validateCombat(
  combatId,
  validatorId,
  allyIds,
  totalAllies = allyIds.length,
) {
  const combat = db.prepare("SELECT * FROM combats WHERE id = ?").get(combatId);
  if (!combat) return null;

  const config = getConfig();
  const points = calculatePoints(
    combat.type,
    config,
    combat.resultat,
    combat.role,
    totalAllies,
    combat.ennemis,
    combat.alliance_focus === 1,
    combat.type,
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

// Annuler la validation d'un combat
export function unvalidateCombat(combatId) {
  const combat = db.prepare("SELECT * FROM combats WHERE id = ?").get(combatId);
  if (!combat || !combat.validated_by) return null;

  const transaction = db.transaction(() => {
    // Remettre le combat en attente de validation
    db.prepare(
      "UPDATE combats SET validated_by = NULL, validated_at = NULL WHERE id = ?",
    ).run(combatId);

    // Supprimer les scores attribués pour ce combat
    db.prepare("DELETE FROM scores WHERE combat_id = ?").run(combatId);
  });

  transaction();

  return { combat };
}

// Récupérer le ladder des 2 dernières semaines
export function getLadder() {
  const [week1, week2] = getLadderWeeks();
  return db
    .prepare(
      `
    SELECT
      s.user_id,
      SUM(s.points) as total_points,
      COUNT(s.id) as combats,
      SUM(CASE WHEN c.resultat = 'Victoire' THEN 1 ELSE 0 END) as victoires
    FROM scores s
    JOIN combats c ON s.combat_id = c.id
    WHERE s.semaine IN (?, ?)
    GROUP BY s.user_id
    ORDER BY total_points DESC
  `,
    )
    .all(week1, week2);
}

// Statistiques d'un joueur pour les 2 dernières semaines
export function getPlayerStats(userId) {
  const [week1, week2] = getLadderWeeks();
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
    WHERE s.user_id = ? AND s.semaine IN (?, ?)
  `,
    )
    .get(userId, week1, week2);
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

// Formater l'embed du ladder
export function formatLadderEmbed() {
  const [week1, week2] = getLadderWeeks();
  const ladder = getLadder();

  const embed = new EmbedBuilder()
    .setTitle("Ladder Percepteurs / Prismes")
    .setColor(0xffd700)
    .setTimestamp()
    .setFooter({ text: `Semaines ${week1} et ${week2}` });

  if (ladder.length === 0) {
    embed.setDescription("Aucun combat validé sur les 2 dernières semaines.");
  } else {
    const medals = ["🥇", "🥈", "🥉"];
    let desc = "";
    for (let i = 0; i < ladder.length; i++) {
      const prefix = i < 3 ? medals[i] : `**${i + 1}.**`;
      const winrate = ((ladder[i].victoires / ladder[i].combats) * 100).toFixed(
        1,
      );
      desc += `${prefix} <@${ladder[i].user_id}> — **${ladder[i].total_points}** pts | **${ladder[i].victoires}**-${ladder[i].combats - ladder[i].victoires} (${winrate}%)\n`;
    }
    embed.setDescription(desc);
  }

  return embed;
}
