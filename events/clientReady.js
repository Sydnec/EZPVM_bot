import { REST, Routes } from "discord.js";
import cron from "node-cron";
import * as db from "../database.js";
import * as percoCommand from "../commands/perco.js";
import * as configCommand from "../commands/config.js";
import updateLadderMessage from "./updateLadderMessage.js";

export default async function clientReady(client) {
  console.log(`[PercoBot] Connecté en tant que ${client.user.tag}`);

  // Initialiser la BDD
  db.init();

  // Enregistrer les slash commands sur le serveur
  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN,
  );
  const commands = [percoCommand.data.toJSON(), configCommand.data.toJSON()];

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      { body: commands },
    );
    console.log("[PercoBot] Slash commands enregistrées.");
  } catch (error) {
    console.error("[PercoBot] Erreur enregistrement commandes:", error);
  }

  // Cron : reset chaque lundi à 00h00
  cron.schedule(
    "0 0 * * 1",
    async () => {
      console.log("[PercoBot] Reset hebdomadaire...");
      try {
        const top = db.weeklyReset();
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return;

        const ladderChannel = guild.channels.cache.get(
          process.env.CHANNEL_LADDER,
        );
        if (!ladderChannel) return;

        // Annonce des gagnants
        if (top.length > 0) {
          const medals = ["🥇", "🥈", "🥉"];
          let announcement = "**Résultats de la semaine !**\n\n";
          for (let i = 0; i < top.length; i++) {
            announcement += `${medals[i]} <@${top[i].user_id}> — **${top[i].total_points}** points\n`;
          }

          // Rôle temporaire au 1er : retirer l'ancien, attribuer au nouveau
          const championRoleName = "Champion Perco";
          const championRole = guild.roles.cache.find(
            (r) => r.name === championRoleName,
          );

          if (championRole) {
            const membersWithRole = championRole.members;
            for (const [, member] of membersWithRole) {
              await member.roles.remove(championRole).catch(() => {});
            }

            const winner = await guild.members
              .fetch(top[0].user_id)
              .catch(() => null);
            if (winner) {
              await winner.roles.add(championRole).catch(() => {});
              announcement += `\n<@${top[0].user_id}> reçoit le rôle **${championRoleName}** pour la semaine !`;
            }
          }

          await ladderChannel.send(announcement);
        }

        // Mettre à jour le message épinglé du ladder (vide après reset)
        await updateLadderMessage(client);
        console.log("[PercoBot] Reset hebdomadaire terminé.");
      } catch (error) {
        console.error("[PercoBot] Erreur reset hebdo:", error);
      }
    },
    { timezone: "Europe/Paris" },
  );
}
