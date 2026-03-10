import { MessageFlags } from "discord.js";
import * as db from "../../database.js";

export default async function reset_ladder(interaction) {
  if (interaction.user.id !== process.env.ADMIN_ID) {
    return interaction.reply({
      content:
        "Cette commande est strictement réservée à l'administrateur.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  db.fullReset();

  await interaction.client.updateLadderMessage();

  await interaction.editReply({
    content:
      "Le ladder a été réinitialisé. La base de données a été purgée et le message du ladder mis à jour.",
  });
}
