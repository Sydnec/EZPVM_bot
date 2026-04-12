# PercoBot

Bot Discord pour le suivi des combats de Percepteurs et Prismes sur Dofus. Système de Ladder hebdomadaire avec validation par les officiers.

## Fonctionnalites

- **Report de combat** : signalement avec screenshots, type, role, resultat, allies
- **Validation** : les Lieutenants valident ou refusent via boutons
- **Ladder temps reel** : classement mis a jour automatiquement dans un message epingle
- **Reset hebdomadaire** : cron chaque lundi a 00h00, annonce des gagnants, role temporaire au 1er
- **Configuration** : points, bonus et multiplicateurs modifiables par les Lieutenants

## Stack

- Node.js
- discord.js v14
- SQLite (better-sqlite3)
- node-cron

## Installation

```bash
git clone <repo-url>
cd EZPVM_bot
npm install
```

Copier `.env.example` vers `.env` et remplir les valeurs :

```bash
cp .env.example .env
```

| Variable             | Description                             |
| -------------------- | --------------------------------------- |
| `DISCORD_TOKEN`      | Token du bot Discord                    |
| `CLIENT_ID`          | ID application du bot                   |
| `GUILD_ID`           | ID du serveur Discord                   |
| `CHANNEL_VALIDATION` | ID du channel de validation des reports |
| `CHANNEL_LADDER`     | ID du channel du ladder                 |
| `ROLE_OFFICIER`      | ID du role Lieutenant                   |
| `ADMIN_ID`           | ID Discord de l'administrateur          |

## Lancement

```bash
# Production
npm start

# Developpement (auto-restart)
npm run dev
```

## Commandes

### `/perco report`

Signaler un combat. Champs : type, role, resultat, ennemis, allies (mentions + `joker`/`j` pour joueurs hors Discord), alliance focus, 2 screenshots.

Important : au moins un allie doit etre mentionne sur Discord pour recevoir les points. Les jokers comptent pour le calcul du multiplicateur numerique mais ne recoivent pas de points au ladder.

Le report est envoye dans le channel de validation avec boutons Valider/Refuser.

### `/perco ladder`

Affiche le classement de la semaine en cours.

### `/perco stats [joueur]`

Affiche les statistiques d'un joueur (points, combats, victoires, defaites).

### `/config voir`

Affiche la configuration actuelle (Lieutenants uniquement).

### `/config modifier <variable> <valeur>`

Modifie une variable de scoring (Lieutenants uniquement).

### `/config reset_ladder`

Reinitialise le ladder et purge la BDD (Admin uniquement).

## Calcul des points

```
Points = Base x Multiplicateur x Bonus Defense x Bonus Focus
```

| Parametre            | Valeur par defaut |
| -------------------- | ----------------- |
| Points Victoire      | 10                |
| Points Defaite       | 3                 |
| Bonus Defense        | x1.5              |
| Bonus Alliance Focus | x2                |

### Multiplicateurs d'inferiorite numerique

| Situation              | Multiplicateur |
| ---------------------- | -------------- |
| Egalite ou superiorite | x1             |
| -1 allie               | x1.5           |
| -2 allies              | x2             |
| -3 allies              | x3             |
| Seul contre 4-5        | x5             |

## Structure du projet

```
PercoBot/
├── index.js                          # Point d'entree, client Discord
├── database.js                       # SQLite : init, CRUD, calcul points
├── commands/
│   ├── perco.js                      # Definition /perco + re-exports
│   ├── perco/
│   │   ├── report.js                 # /perco report
│   │   ├── ladder.js                 # /perco ladder
│   │   └── stats.js                  # /perco stats
│   ├── config.js                     # Definition /config + re-exports
│   └── config/
│       ├── voir.js                   # /config voir
│       ├── modifier.js               # /config modifier
│       └── reset_ladder.js           # /config reset_ladder
└── events/
    ├── clientReady.js                # Init BDD, enregistrement commandes, cron
    ├── interactionCreate.js          # Router interactions
    ├── updateLadderMessage.js        # Mise a jour du message ladder epingle
    └── handlers/
        ├── slashCommand.js           # Dispatch des slash commands
        └── buttonValidation.js       # Logique boutons Valider/Refuser
```

## Permissions requises du bot

- Envoyer des messages
- Gerer les messages (pour epingler le ladder)
- Integrer des liens (embeds)
- Lire l'historique des messages
