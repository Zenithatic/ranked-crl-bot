import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/commandchecks";
import { getUserData, terminateGame } from "../../utils/db/registrationdb";
dotenv.config();

// Create a cooldown manager for this command with 30-second cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.THIRTY_SECONDS);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("terminategame")
    .setDescription("Force terminate the current ranked game.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), // Allow only people who can ban members to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;

    // Check if channel is a match channel
    if (
      !interaction.channel ||
      interaction.channel.type !== ChannelType.GuildText ||
      !interaction.channel.name ||
      !interaction.channel.name.startsWith("match-")
    ) {
      await interaction.reply({
        content: "❌ This command can only be used in a match channel.",
        ephemeral: true,
      });
      return;
    }

    const player1id = interaction.channel.name.split("-")[1];
    const player2id = interaction.channel.name.split("-")[2];
    const player1data = await getUserData(player1id);
    const player2data = await getUserData(player2id);

    if (!player1data || !player2data) {
      await interaction.reply({
        content: "❌ Error retrieving player data. Please contact a developer.",
        ephemeral: true,
      });
      return;
    }

    // Terminate game for both players
    await terminateGame(player1id);
    await terminateGame(player2id);

    // Delete match channel
    if (
      interaction.channel &&
      interaction.channel.type === ChannelType.GuildText
    ) {
      await interaction.channel.delete();
    }
  },
};
