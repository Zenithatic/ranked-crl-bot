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
    .setCustomId("register")
    .setLabel("Initiate Registration")
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId("verify")
    .setLabel("Verify Registration")
    .setStyle(ButtonStyle.Secondary)
);

// Embed
const embed = new EmbedBuilder()
  .setColor(0x0099ff)
  .setTitle("Register and Verify your Clash Royale Account")
  .setDescription(
    "Start your registration process by pressing Initiate Registration below. Once you've followed the instructions sent, press Verify Registration to complete your registration."
  );

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sendregisterbuttons")
    .setDescription("Send the registration buttons.")
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
      content: "✅ Registration buttons sent!",
      ephemeral: true,
    });
  },
};
