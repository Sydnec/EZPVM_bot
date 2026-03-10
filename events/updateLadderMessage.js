import { EmbedBuilder } from "discord.js";
import * as db from "../database.js";

export default async function updateLadderMessage(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(process.env.CHANNEL_LADDER);
  if (!channel) return;

  // Chercher le message épinglé du bot
  const pinsResult = await channel.messages.fetchPins();
  const pins = pinsResult instanceof Map ? [...pinsResult.values()] : Array.isArray(pinsResult) ? pinsResult : [];
  const ladderMsg = pins.find((m) => m.author.id === client.user.id);

  const ladder = db.getLadder();

  const embed = new EmbedBuilder()
    .setTitle("Ladder Percepteurs / Prismes")
    .setColor(0xffd700)
    .setTimestamp()
    .setFooter({ text: `Semaine ${db.getCurrentWeek()}` });

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

  if (ladderMsg) {
    await ladderMsg.edit({ embeds: [embed] });
  } else {
    const newMsg = await channel.send({ embeds: [embed] });
    await newMsg
      .pin()
      .catch(() =>
        console.warn(
          '[PercoBot] Impossible d\'épingler le message du ladder. Vérifiez la permission "Gérer les messages".',
        ),
      );
  }
}
