import { MessageFlags } from "discord.js";
import * as db from "../../database.js";

export default async function ladder(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const embed = db.formatLadderEmbed();
  await interaction.editReply({ embeds: [embed] });
}
