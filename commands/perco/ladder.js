import { EmbedBuilder, MessageFlags } from "discord.js";
import * as db from "../../database.js";

export default async function ladder(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const ladderData = db.getLadder();
  const embed = new EmbedBuilder()
    .setTitle("Ladder Percepteurs / Prismes")
    .setColor(0xffd700)
    .setTimestamp()
    .setFooter({ text: `Semaine ${db.getCurrentWeek()}` });

  if (ladderData.length === 0) {
    embed.setDescription("Aucun combat validé cette semaine.");
  } else {
    const medals = ["🥇", "🥈", "🥉"];
    let desc = "";
    for (let i = 0; i < ladderData.length; i++) {
      const prefix = i < 3 ? medals[i] : `**${i + 1}.**`;
      desc += `${prefix} <@${ladderData[i].user_id}> — **${ladderData[i].total_points}** pts (${ladderData[i].combats} combat${ladderData[i].combats > 1 ? "s" : ""})\n`;
    }
    embed.setDescription(desc);
  }

  await interaction.editReply({ embeds: [embed] });
}
