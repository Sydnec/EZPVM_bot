import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import * as db from "../../database.js";
import { info, warn, error as logError } from "../../logger.js";

export default async function handleButton(client, interaction) {
  const [action, combatIdStr] = interaction.customId.split("_");
  const combatId = parseInt(combatIdStr, 10);

  if (action !== "validate" && action !== "refuse") return;

  info(
    `Action bouton: ${action} sur combat #${combatId} par ${interaction.user.tag} (${interaction.user.id})`,
  );

  // Vérification rôle Lieutenant
  if (!interaction.member.roles.cache.has(process.env.ROLE_OFFICIER)) {
    warn(
      `Refus permission validation: ${interaction.user.tag} (${interaction.user.id}) sur combat #${combatId}`,
    );
    return interaction.reply({
      content: "Seuls les Lieutenants peuvent valider ou refuser un report.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // deferUpdate immédiatement pour éviter le timeout
  await interaction.deferUpdate();

  try {
    // Désactiver les boutons
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`validate_${combatId}`)
        .setLabel("Valider")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅")
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`refuse_${combatId}`)
        .setLabel("Refuser")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
        .setDisabled(true),
    );

    if (action === "refuse") {
      const originalEmbeds = interaction.message.embeds.map((e) =>
        EmbedBuilder.from(e),
      );
      if (originalEmbeds.length > 0) {
        originalEmbeds[0].setColor(0x95a5a6).addFields({
          name: "Statut",
          value: `❌ Refusé par <@${interaction.user.id}>`,
        });
      }

      await interaction.message.edit({
        embeds: originalEmbeds,
        components: [disabledRow],
      });
      info(
        `Report refusé: combat #${combatId} par ${interaction.user.tag} (${interaction.user.id})`,
      );
      return;
    }

    // --- Validation ---
    const infoEmbed = interaction.message.embeds[0];
    const alliesField = infoEmbed.fields.find((f) => f.name === "Alliés");
    if (!alliesField) {
      await interaction.followUp({
        content: "Erreur : impossible de trouver les alliés dans le report.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const allyIds = [];
    const mentionRegex = /<@!?(\d+)>/g;
    let match;
    while ((match = mentionRegex.exec(alliesField.value)) !== null) {
      if (!allyIds.includes(match[1])) {
        allyIds.push(match[1]);
      }
    }

    if (allyIds.length === 0) {
      await interaction.followUp({
        content: "Erreur : aucun allié trouvé dans le report.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = db.validateCombat(combatId, interaction.user.id, allyIds);

    if (!result) {
      await interaction.followUp({
        content: "Erreur : combat introuvable en base de données.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Mettre à jour le message de validation
    const originalEmbeds = interaction.message.embeds.map((e) =>
      EmbedBuilder.from(e),
    );
    if (originalEmbeds.length > 0) {
      originalEmbeds[0].setColor(0x2ecc71).addFields(
        {
          name: "Statut",
          value: `✅ Validé par <@${interaction.user.id}>`,
        },
        {
          name: "Points attribués",
          value: `**${result.points}** pts/joueur`,
        },
      );
    }

    await interaction.message.edit({
      embeds: originalEmbeds,
      components: [disabledRow],
    });

    info(
      `Report validé: combat #${combatId} par ${interaction.user.tag} (${interaction.user.id}), points=${result.points}, ennemis=${result.combat.ennemis}, alliés=${allyIds.length}`,
    );

    // Mettre à jour le ladder épinglé
    await client.updateLadderMessage();
  } catch (error) {
    logError("Erreur validation bouton:", error);
    await interaction
      .followUp({
        content: "Une erreur est survenue lors du traitement.",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
}
