import { MessageFlags } from "discord.js";
import { info, error as logError } from "../../logger.js";

export default async function handleSlashCommand(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const subcommand = interaction.options.getSubcommand();
  info(
    `Commande reçue: /${interaction.commandName} ${subcommand} par ${interaction.user.tag}`,
  );

  try {
    if (typeof command[subcommand] === "function") {
      await command[subcommand](interaction);
      info(
        `Commande exécutée: /${interaction.commandName} ${subcommand} par ${interaction.user.tag}`,
      );
    }
  } catch (error) {
    logError(
      `Erreur commande ${interaction.commandName} ${subcommand}:`,
      error,
    );
    const reply = {
      content: "Une erreur est survenue lors de l'exécution de la commande.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}
