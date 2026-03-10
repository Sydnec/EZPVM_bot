import { MessageFlags } from "discord.js";

export default async function handleSlashCommand(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const subcommand = interaction.options.getSubcommand();

  try {
    if (typeof command[subcommand] === "function") {
      await command[subcommand](interaction);
    }
  } catch (error) {
    console.error(
      `[PercoBot] Erreur commande ${interaction.commandName} ${subcommand}:`,
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
