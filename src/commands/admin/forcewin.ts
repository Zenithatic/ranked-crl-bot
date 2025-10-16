// Imports
import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getUserData } from "@/src/utils/db/registrationdb";
import { handleGameEnd } from "@/src/utils/functions/handleGameEnd";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forcewin")
    .setDescription("Force a win for the specified player.")
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The player to force a win for.")
        .setRequired(true)
    )
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

    // Get player ids
    const player1id = interaction.channel.name.split("-")[1];
    const player2id = interaction.channel.name.split("-")[2];

    // Check if specified player is in the match
    const specifiedPlayer = interaction.options.getUser("player");
    if (
      !specifiedPlayer ||
      (specifiedPlayer.id !== player1id && specifiedPlayer.id !== player2id)
    ) {
      await interaction.reply({
        content: "❌ The specified player is not in this match.",
        ephemeral: true,
      });
      return;
    }

    // Get player data
    const winnerId = specifiedPlayer.id;
    const loserId = winnerId === player1id ? player2id : player1id;
    const winnerdata = await getUserData(winnerId);
    const loserdata = await getUserData(loserId);

    if (!winnerdata || !loserdata) {
      await interaction.reply({
        content: "❌ Error retrieving player data. Please contact a developer.",
        ephemeral: true,
      });
      return;
    }

    // Force win
    handleGameEnd(
      winnerdata,
      loserdata,
      1,
      0,
      winnerId,
      loserId,
      [],
      interaction,
      "Forced Win"
    );
  },
};
