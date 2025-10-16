// Imports
import { ButtonBuilder } from "@discordjs/builders";
import {
  ActionRowBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

// Button row
const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("queue-join")
    .setLabel("Join Queue")
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId("queue-leave")
    .setLabel("Leave Queue")
    .setStyle(ButtonStyle.Danger)
);

// Embed
const embed = new EmbedBuilder()
  .setColor(0x0099ff)
  .setTitle("Ranked Queue")
  .setDescription(
    "Join the ranked queue to find a match! You can optionally set a friend link too."
  );

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sendqueuebuttons")
    .setDescription("Send the queue join/leave buttons.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction) {
    // Ensure command is used in a text channel
    const channel = interaction.channel;
    if (!channel) {
      await interaction.reply({
        content: "❌ This command can only be used in a channel.",
        ephemeral: true,
      });
      return;
    }
    const textchannel = channel as TextChannel;

    // Send the embed with buttons
    await textchannel.send({ embeds: [embed], components: [row.toJSON()] });
    await interaction.reply({
      content: "✅ Queue buttons sent!",
      ephemeral: true,
    });
  },
};
