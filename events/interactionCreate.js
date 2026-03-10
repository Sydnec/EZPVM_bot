import handleSlashCommand from "./handlers/slashCommand.js";
import handleButton from "./handlers/buttonValidation.js";

export default async function interactionCreate(client, interaction) {
  if (interaction.isChatInputCommand()) {
    return handleSlashCommand(client, interaction);
  }

  if (interaction.isButton()) {
    return handleButton(client, interaction);
  }
}
