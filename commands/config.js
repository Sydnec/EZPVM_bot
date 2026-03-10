import { SlashCommandBuilder } from "discord.js";
import { CONFIG_KEYS } from "./config/voir.js";
import voir from "./config/voir.js";
import modifier from "./config/modifier.js";
import reset_ladder from "./config/reset_ladder.js";

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configuration du bot (Lieutenants)")
  .addSubcommand((sub) =>
    sub.setName("voir").setDescription("Affiche la configuration actuelle"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("modifier")
      .setDescription("Modifier une variable de configuration")
      .addStringOption((opt) =>
        opt
          .setName("variable")
          .setDescription("Variable à modifier")
          .setRequired(true)
          .addChoices(
            ...Object.entries(CONFIG_KEYS).map(([value, name]) => ({
              name,
              value,
            })),
          ),
      )
      .addNumberOption((opt) =>
        opt
          .setName("valeur")
          .setDescription("Nouvelle valeur")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("reset_ladder")
      .setDescription("Réinitialiser le ladder (Admin uniquement)"),
  );

export { voir, modifier, reset_ladder };
