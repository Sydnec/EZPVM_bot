import { SlashCommandBuilder } from "discord.js";
import report from "./perco/report.js";
import ladder from "./perco/ladder.js";
import stats from "./perco/stats.js";

export const data = new SlashCommandBuilder()
  .setName("perco")
  .setDescription("Commandes liées aux Percepteurs/Prismes")
  .addSubcommand((sub) =>
    sub
      .setName("report")
      .setDescription("Signaler un combat de Percepteur/Prisme")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Type de cible")
          .setRequired(true)
          .addChoices(
            { name: "Percepteur", value: "Percepteur" },
            { name: "Prisme", value: "Prisme" },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName("role")
          .setDescription("Votre rôle dans le combat")
          .setRequired(true)
          .addChoices(
            { name: "Attaque", value: "Attaque" },
            { name: "Défense", value: "Défense" },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName("resultat")
          .setDescription("Résultat du combat")
          .setRequired(true)
          .addChoices(
            { name: "Victoire", value: "Victoire" },
            { name: "Défaite", value: "Défaite" },
          ),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("ennemis")
          .setDescription("Nombre d'ennemis (1-5)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(5)
          .addChoices(
            { name: "1", value: 1 },
            { name: "2", value: 2 },
            { name: "3", value: 3 },
            { name: "4", value: 4 },
            { name: "5", value: 5 },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName("allies")
          .setDescription(
            "Mentionnez les alliés présents (@joueur1 @joueur2...)",
          )
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("alliance_focus")
          .setDescription("Combat en Alliance Focus ?")
          .setRequired(true)
          .addChoices(
            { name: "Oui", value: "Oui" },
            { name: "Non", value: "Non" },
          ),
      )
      .addAttachmentOption((opt) =>
        opt
          .setName("screen1")
          .setDescription("Screenshot 1 (obligatoire)")
          .setRequired(true),
      )
      .addAttachmentOption((opt) =>
        opt
          .setName("screen2")
          .setDescription("Screenshot 2 (obligatoire)")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("ladder")
      .setDescription("Afficher le classement de la semaine"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("stats")
      .setDescription("Afficher vos statistiques de la semaine")
      .addUserOption((opt) =>
        opt
          .setName("joueur")
          .setDescription("Joueur à consulter (vous par défaut)")
          .setRequired(false),
      ),
  );

export { report, ladder, stats };
