import { EmbedBuilder, MessageFlags } from "discord.js";
import * as db from "../../database.js";

export default async function stats(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser("joueur") || interaction.user;
  const playerStats = db.getPlayerStats(targetUser.id);

  const embed = new EmbedBuilder()
    .setTitle(`Statistiques de ${targetUser.username}`)
    .setColor(0x9b59b6)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: `2 dernières semaines` });

  if (!playerStats || !playerStats.total_points) {
    embed.setDescription("Aucun combat validé sur les 2 dernières semaines.");
  } else {
    embed.addFields(
      {
        name: "Points",
        value: `**${playerStats.total_points}**`,
        inline: true,
      },
      { name: "Combats", value: `${playerStats.combats}`, inline: true },
      { name: "Victoires", value: `${playerStats.victoires}`, inline: true },
      { name: "Défaites", value: `${playerStats.defaites}`, inline: true },
    );
  }

  await interaction.editReply({ embeds: [embed] });
}
