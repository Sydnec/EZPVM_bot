import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import * as db from "../../database.js";
import { info, warn, error as logError } from "../../logger.js";

function parseStoredAllies(storedAllies = "") {
  const tokens = storedAllies
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  const discordIds = [];
  let jokerCount = 0;

  for (const token of tokens) {
    if (token.startsWith("discord:")) {
      const id = token.slice("discord:".length);
      if (id && !discordIds.includes(id)) {
        discordIds.push(id);
      }
      continue;
    }

    if (token === "joker") {
      jokerCount += 1;
      continue;
    }

    // Compatibilite anciens reports: stockes uniquement sous forme d'ID Discord.
    if (/^\d+$/.test(token) && !discordIds.includes(token)) {
      discordIds.push(token);
    }
  }

  return {
    discordIds,
    totalAllies: discordIds.length + jokerCount,
  };
}

export default async function handleButton(client, interaction) {
  const [action, combatIdStr] = interaction.customId.split("_");
  const combatId = parseInt(combatIdStr, 10);

  if (action !== "validate" && action !== "refuse" && action !== "cancel") return;

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
    // Boutons désactivés (pour refus)
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

    // Boutons actifs (pour report en attente)
    const activeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`validate_${combatId}`)
        .setLabel("Valider")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId(`refuse_${combatId}`)
        .setLabel("Refuser")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
    );

    // --- Annulation de validation ---
    if (action === "cancel") {
      // Seul celui qui a validé peut annuler
      const combat = db.getCombat(combatId);
      if (!combat || !combat.validated_by) {
        await interaction.followUp({
          content: "Erreur : ce combat n'est pas validé ou est introuvable.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (combat.validated_by !== interaction.user.id) {
        warn(
          `Refus annulation: ${interaction.user.tag} (${interaction.user.id}) n'est pas le validateur du combat #${combatId}`,
        );
        await interaction.followUp({
          content: "Seul le Lieutenant qui a validé ce report peut annuler la validation.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = db.unvalidateCombat(combatId);
      if (!result) {
        await interaction.followUp({
          content: "Erreur : impossible d'annuler la validation.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Remettre l'embed dans son état initial (retirer Statut et Points attribués)
      const originalEmbeds = interaction.message.embeds.map((e) =>
        EmbedBuilder.from(e),
      );
      if (originalEmbeds.length > 0) {
        const embed = originalEmbeds[0];
        const fieldsToKeep = embed.data.fields.filter(
          (f) => f.name !== "Statut" && f.name !== "Points attribués",
        );
        embed.setFields(fieldsToKeep);
        embed.setColor(result.combat.resultat === "Victoire" ? 0x2ecc71 : 0xe74c3c);
      }

      await interaction.message.edit({
        embeds: originalEmbeds,
        components: [activeRow],
      });

      info(
        `Validation annulée: combat #${combatId} par ${interaction.user.tag} (${interaction.user.id})`,
      );

      // Mettre à jour le ladder épinglé
      await client.updateLadderMessage();
      return;
    }

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
    const combat = db.getCombat(combatId);
    if (!combat) {
      await interaction.followUp({
        content: "Erreur : combat introuvable en base de données.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { discordIds, totalAllies } = parseStoredAllies(combat.allies);

    if (totalAllies === 0 || discordIds.length === 0) {
      await interaction.followUp({
        content: "Erreur : aucun allié Discord valide trouvé dans le report.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = db.validateCombat(
      combatId,
      interaction.user.id,
      discordIds,
      totalAllies,
    );

    if (!result) {
      await interaction.followUp({
        content: "Erreur : combat introuvable en base de données.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Bouton d'annulation (seul le validateur pourra l'utiliser)
    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cancel_${combatId}`)
        .setLabel("Annuler la validation")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("↩️"),
    );

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
      components: [cancelRow],
    });

    info(
      `Report validé: combat #${combatId} par ${interaction.user.tag} (${interaction.user.id}), points=${result.points}, ennemis=${result.combat.ennemis}, alliés_total=${totalAllies}, alliés_discord=${discordIds.length}`,
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
