// Imports
import { getUserData } from "../../utils/db/registrationdb";
import { handleGameEnd } from "../../utils/functions/handleGameEnd";
import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("terminategame")
    .setDescription("Force terminate the current ranked game.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), // Allow only people who can ban members to use this command
  async execute(interaction: ChatInputCommandInteraction) {
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

    // Get player ids and data
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

    handleGameEnd(
      player1data,
      player2data,
      0,
      0,
      player1id,
      player2id,
      [],
      interaction,
      "Terminated"
    );
  },
};
