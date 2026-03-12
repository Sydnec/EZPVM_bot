import { EmbedBuilder } from "discord.js";
import * as db from "../database.js";

export default async function updateLadderMessage(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(process.env.CHANNEL_LADDER);
  if (!channel) return;
  const currentWeek = db.getCurrentWeek();

  // Récupérer le dernier message non-système du bot dans le channel
  const messages = await channel.messages.fetch({ limit: 10 });
  const ladderMsg =
    messages.find((m) => m.author.id === client.user.id && !m.system) ?? null;

  const ladder = db.getLadder();

  const embed = new EmbedBuilder()
    .setTitle(`Ladder Percepteurs / Prismes - Semaine ${currentWeek}`)
    .setColor(0xffd700)
    .setTimestamp()
    .setFooter({ text: `Semaine ${currentWeek}` });

  if (ladder.length === 0) {
    embed.setDescription("Aucun combat validé cette semaine.");
  } else {
    const medals = ["🥇", "🥈", "🥉"];
    let desc = "";
    for (let i = 0; i < ladder.length; i++) {
      const prefix = i < 3 ? medals[i] : `**${i + 1}.**`;
      desc += `${prefix} <@${ladder[i].user_id}> — **${ladder[i].total_points}** pts (${ladder[i].combats} combat${ladder[i].combats > 1 ? "s" : ""})\n`;
    }
    embed.setDescription(desc);
  }

  const ladderMsgWeek = ladderMsg?.embeds?.[0]?.footer?.text ?? null;
  const isCurrentWeekMessage = ladderMsgWeek === `Semaine ${currentWeek}`;

  if (ladderMsg && isCurrentWeekMessage) {
    await ladderMsg.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] }).pin();
  }
}
