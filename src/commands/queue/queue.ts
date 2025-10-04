import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { queuePlayer } from "../../utils/cache/queuecache";
import { CooldownManager, COOLDOWN_TIMES } from "../../utils/classes/cooldown";
import { commandCheck } from "../../utils/functions/commandchecks";
import { getUserData } from "../../utils/db/registrationdb";
dotenv.config();

// Create a cooldown manager for this command with 1-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

const matchChannelCategory = "1421362444382507049";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Enter the ranked queue to be matched with other players.")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;

    // Attempt to queue the user
    const userId = interaction.user.id;
    const result = await queuePlayer(userId);

    if (result.success) {
      if (result.match) {
        // Fetch user data
        let player1data = await getUserData(userId);
        let player2data = await getUserData(result.match.discordId);

        if (!player1data || !player2data) {
          await interaction.reply({
            content:
              "❌ Error retrieving player data. Please contact an admin.",
            ephemeral: true,
          });
          return;
        }

        // create private channel only for the two players to discuss
        const newchannel = await interaction.guild!.channels.create({
          name: `match-${userId}-${result.match.discordId}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: interaction.guild!.roles.everyone.id, // Deny everyone
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: userId, // Allow player 1
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: result.match.discordId, // Allow player 2
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ],
        });
        await newchannel.setParent(matchChannelCategory);

        // player tags and elos
        const playertag1 = player1data!.playerTag;
        const playertag2 = player2data!.playerTag;
        const player1elo = player1data!.elo;
        const player2elo = player2data!.elo;

        await newchannel.send({
          embeds: [
            {
              title: `Match: #${playertag1} (${player1elo} elo) vs #${playertag2} (${player2elo} elo)`,
              description: `<@${result.match.discordId}> has been matched with <@${userId}>!\n\n
                Please coordinate with each other to play your matches.\n
                This match is a DUEL (no card duplicates between matches per player, best of 3)\n
                Do not play any other matches / gamemodes until this game is complete. \n
                Once the best of 3 is complete, one of the players must run /finishgame.\n
                Disconnects are considered complete games.\n
                If you have any issues, please contact an admin.`,
              color: 0x00ff00,
            },
          ],
          content: `<@${userId}> <@${result.match.discordId}>`,
        });

        // respond
        await interaction.reply({
          content: `✅ Match found! You have been paired with <@${result.match.discordId}> (Player Tag: ${result.match.playerTag}). Please coordinate with them to start your match.`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: `✅ ${result.message}`,
          ephemeral: true,
        });
      }
    } else {
      await interaction.reply({
        content: `❌ ${result.message}`,
        ephemeral: true,
      });
    }

    // Set cooldown after successful execution
    cooldown.setCooldown(userId);
  },
};
