import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import * as db from "../../database.js";
import { info } from "../../logger.js";

export default async function report(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const type = interaction.options.getString("type");
  const role = interaction.options.getString("role");
  const resultat = interaction.options.getString("resultat");
  const ennemis = interaction.options.getInteger("ennemis");
  const alliesRaw = interaction.options.getString("allies");
  const allianceFocus =
    interaction.options.getString("alliance_focus") === "Oui";
  const screen1 = interaction.options.getAttachment("screen1");
  const screen2 = interaction.options.getAttachment("screen2");

  info(
    `Début report perco par ${interaction.user.tag} (${interaction.user.id})`,
  );

  // Extraction des IDs depuis les mentions
  const allyIds = [];
  const mentionRegex = /<@!?(\d+)>/g;
  let match;
  while ((match = mentionRegex.exec(alliesRaw)) !== null) {
    if (!allyIds.includes(match[1])) {
      allyIds.push(match[1]);
    }
  }

  if (allyIds.length === 0) {
    return interaction.editReply({
      content:
        "Vous devez mentionner au moins un allié (taguez-vous vous-même si vous étiez seul).",
    });
  }

  if (allyIds.length > 5) {
    return interaction.editReply({
      content: "Le nombre d'alliés ne peut pas dépasser 5.",
    });
  }

  // Insérer le combat en BDD (non validé)
  const result = db.insertCombat({
    reporterId: interaction.user.id,
    type,
    role,
    resultat,
    ennemis,
    allies: allyIds.join(","),
    allianceFocus,
    screen1Url: screen1.url,
    screen2Url: screen2.url,
  });
  const combatId = result.lastInsertRowid;
  info(
    `Report créé: combat #${combatId} par ${interaction.user.tag} (${interaction.user.id})`,
  );

  // Calcul de prévisualisation des points
  const config = db.getConfig();
  const previewPoints = db.calculatePoints(
    config,
    resultat,
    role,
    allyIds.length,
    ennemis,
    allianceFocus,
  );

  // Embed 1 : Infos du combat
  const embedInfo = new EmbedBuilder()
    .setTitle(`Combat ${type} — ${resultat}`)
    .setColor(resultat === "Victoire" ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      { name: "Type", value: type, inline: true },
      { name: "Rôle", value: role, inline: true },
      { name: "Résultat", value: resultat, inline: true },
      { name: "Ennemis", value: `${ennemis}`, inline: true },
      {
        name: "Alliés",
        value: allyIds.map((id) => `<@${id}>`).join(", "),
        inline: true,
      },
      {
        name: "Alliance Focus",
        value: allianceFocus ? "Oui" : "Non",
        inline: true,
      },
      {
        name: "Points estimés",
        value: `**${previewPoints}** pts/joueur`,
        inline: false,
      },
    )
    .setFooter({
      text: `Report par ${interaction.member.displayName} | Combat #${combatId}`,
    })
    .setTimestamp();

  // Embed 2 & 3 : Screenshots
  const embedScreen1 = new EmbedBuilder()
    .setTitle("Screenshot 1")
    .setImage(screen1.url)
    .setColor(0x3498db);

  const embedScreen2 = new EmbedBuilder()
    .setTitle("Screenshot 2")
    .setImage(screen2.url)
    .setColor(0x3498db);

  // Boutons de validation
  const row = new ActionRowBuilder().addComponents(
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

  // Envoyer dans le channel de validation
  const validationChannel = await interaction.client.channels
    .fetch(process.env.CHANNEL_VALIDATION)
    .catch(() => null);
  if (!validationChannel) {
    return interaction.editReply({
      content:
        "Le channel de validation est introuvable. Contactez un administrateur.",
    });
  }

  await validationChannel.send({
    embeds: [embedInfo, embedScreen1, embedScreen2],
    components: [row],
  });

  info(
    `Report envoyé en validation: combat #${combatId} dans channel ${process.env.CHANNEL_VALIDATION}`,
  );

  await interaction.editReply({
    content: `Votre report (Combat #${combatId}) a été envoyé dans <#${process.env.CHANNEL_VALIDATION}> pour validation.`,
  });
}
