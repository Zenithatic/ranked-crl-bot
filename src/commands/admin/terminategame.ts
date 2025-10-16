import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  COOLDOWN_TIMES,
  CooldownManager,
} from "../../utils/classes_types/cooldown";
import { getUserData, updateUserData } from "../../utils/db/registrationdb";
import { commandCheck } from "../../utils/functions/interactionchecks";

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

    // Fetch messages from the channel before deleting it
    let messageLog = "";
    if (
      interaction.channel &&
      interaction.channel.type === ChannelType.GuildText
    ) {
      try {
        const messages = await interaction.channel.messages.fetch({
          limit: 25,
        });
        const messageArray = messages
          .filter((msg) => !msg.author.bot) // Filter out bot messages
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp) // Sort by creation time
          .map((msg) => `${msg.author.displayName}: ${msg.content}`)
          .slice(0, 25); // Limit to last 25 messages

        messageLog = messageArray.join("\n");
        if (messageLog.length === 0) {
          messageLog = "No messages found in this channel.";
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
        messageLog = "Error fetching message log.";
      }
    }

    // Create embed for terminated game log
    const terminatedGameLogChannel = "1427806869786853516";
    const logChannel = await interaction.guild!.channels.fetch(
      terminatedGameLogChannel
    );

    if (logChannel && logChannel.isTextBased()) {
      const embedFields = [
        {
          name: "Message log:",
          value: `\`\`\`\n${messageLog}\n\`\`\``,
          inline: false,
        },
      ];

      // Include ELO ratings if user data is already fetched
      if (player1data && player2data) {
        embedFields.push({
          name: "ELO Ratings",
          value: `<@${player1id}>: ${player1data.elo} | <@${player2id}>: ${player2data.elo}`,
          inline: false,
        });
      }

      const embed = {
        title: `Terminated Game - ${interaction.channel?.name}`,
        description: `Terminated game - <@${player1id}> against <@${player2id}>`,
        fields: embedFields,
        color: 0xff0000, // Red color for terminated games
        timestamp: new Date().toISOString(),
      };

      try {
        await logChannel.send({ embeds: [embed] });
      } catch (error) {
        console.error("Error sending terminated game log:", error);
      }
    }

    // Terminate game for both players
    await updateUserData(player1id, {
      in_game: false,
      current_opponent: "",
    });
    await updateUserData(player2id, {
      in_game: false,
      current_opponent: "",
    });

    // Delete match channel
    if (
      interaction.channel &&
      interaction.channel.type === ChannelType.GuildText
    ) {
      await interaction.channel.delete();
    }
  },
};
