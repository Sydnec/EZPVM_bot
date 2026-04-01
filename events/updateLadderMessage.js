import * as db from "../database.js";

export default async function updateLadderMessage(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(process.env.CHANNEL_LADDER);
  if (!channel) return;

  const embed = db.formatLadderEmbed();
  const [week1, week2] = db.getLadderWeeks();

  // Récupérer le dernier message non-système du bot dans le channel
  const messages = await channel.messages.fetch({ limit: 10 });
  const ladderMsg =
    messages.find((m) => m.author.id === client.user.id && !m.system) ?? null;

  const isCurrentPair = ladderMsg?.embeds?.[0]?.footer?.text === `Semaines ${week1} et ${week2}`;

  if (ladderMsg && isCurrentPair) {
    await ladderMsg.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] }).pin();
  }
}
