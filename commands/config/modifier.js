import { MessageFlags } from "discord.js";
import * as db from "../../database.js";
import { CONFIG_KEYS } from "./voir.js";

export default async function modifier(interaction) {
  if (!interaction.member.roles.cache.has(process.env.ROLE_OFFICIER)) {
    return interaction.reply({
      content: "Cette commande est réservée aux Lieutenants.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const variable = interaction.options.getString("variable");
  const valeur = interaction.options.getNumber("valeur");

  if (!(variable in CONFIG_KEYS)) {
    return interaction.reply({
      content: "Variable inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (valeur < 0) {
    return interaction.reply({
      content: "La valeur ne peut pas être négative.",
      flags: MessageFlags.Ephemeral,
    });
  }

  db.setConfig(variable, valeur);

  await interaction.reply({
    content: `**${CONFIG_KEYS[variable]}** mis à jour : **${valeur}**`,
    flags: MessageFlags.Ephemeral,
  });
}
