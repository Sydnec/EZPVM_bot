import { EmbedBuilder, MessageFlags } from "discord.js";
import * as db from "../../database.js";

export const CONFIG_KEYS = {
  points_victoire: "Points Victoire",
  points_defaite: "Points Défaite",
  bonus_defense: "Bonus Défense",
  bonus_alliance_focus: "Bonus Alliance Focus",
  multi_egal: "Multi. Égalité/Supériorité",
  multi_moins1: "Multi. -1 allié",
  multi_moins2: "Multi. -2 alliés",
  multi_moins3: "Multi. -3 alliés",
  multi_moins4: "Multi. -4 alliés",
  multi_plus1: "Multi. +1 allié",
  multi_plus2: "Multi. +2 alliés",
  multi_plus3: "Multi. +3 alliés",
  multi_plus4: "Multi. +4 alliés",
};

export default async function voir(interaction) {
  if (!interaction.member.roles.cache.has(process.env.ROLE_OFFICIER)) {
    return interaction.reply({
      content: "Cette commande est réservée aux Lieutenants.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const config = db.getConfig();
  const embed = new EmbedBuilder()
    .setTitle("Configuration PercoBot")
    .setColor(0x3498db)
    .setTimestamp();

  for (const [key, label] of Object.entries(CONFIG_KEYS)) {
    embed.addFields({ name: label, value: `${config[key]}`, inline: true });
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
