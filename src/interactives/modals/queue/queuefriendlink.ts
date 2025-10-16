// Imports
import {
  ChannelType,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getUserData, updateUserData } from "@/src/utils/db/registrationdb";
import { queuePlayer } from "@/src/utils/cache/queuecache";

const matchChannelCategory = "1421362444382507049";
// Button row
const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("finish-game")
    .setLabel("Finish Game")
    .setStyle(ButtonStyle.Success)
);
module.exports = {
  customId: "queue-friendlink-modal",
  async execute(interaction: ModalSubmitInteraction) {
    const userId = interaction.user.id;
    // Extract friend link from modal input
    const friendLink =
      interaction.fields.getTextInputValue("friend-link-input");

    // Check for valid friend link if provided
    if (friendLink && friendLink.length > 0) {
      if (
        !friendLink.startsWith("https://link.clashroyale.com/invite/friend")
      ) {
        await interaction.reply({
          content:
            "❌ Invalid friend link. Please provide a valid Clash Royale friend link.",
          ephemeral: true,
        });
        return;
      }

      // Set friend link
      const res = await updateUserData(userId, {
        friend_link: friendLink,
      });

      if (!res) {
        await interaction.reply({
          content: "❌ Error updating friend link. Please contact an admin.",
          ephemeral: true,
        });
        return;
      }
    }

    // Attempt to queue the user
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

        // Player tags and elos
        const playertag1 = player1data.playerTag;
        const playertag2 = player2data.playerTag;
        const player1elo = player1data.elo;
        const player2elo = player2data.elo;

        // Fetch guild members to ensure they're cached
        const player1Member = await interaction.guild!.members.fetch(userId);
        const player2Member = await interaction.guild!.members.fetch(
          result.match.discordId
        );

        // Create private channel only for the two players to discuss
        const newchannel = await interaction.guild!.channels.create({
          name: `match-${userId}-${result.match.discordId}`,
          type: ChannelType.GuildText,
          parent: matchChannelCategory,
          topic: `time-${Date.now()}`,
        });

        // Get Verified role and Mod role
        const verifiedRole = interaction.guild!.roles.cache.find(
          (role) => role.name === "Verified"
        );
        const modRole = interaction.guild!.roles.cache.find(
          (role) => role.name === "Mod"
        );

        await newchannel.permissionOverwrites.set([
          {
            id: interaction.guild!.roles.everyone.id, // Deny everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: verifiedRole!.id, // Deny Verified role
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: player1Member, // Allow player 1
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: player2Member, // Allow player 2
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: modRole!.id, // Allow mods
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ]);

        // Get friendlinks and send to channel
        const player1link = player1data.friend_link;
        const player2link = player2data.friend_link;

        await newchannel.send({
          embeds: [
            {
              title: `Match: #${playertag1} (${player1elo} elo) vs #${playertag2} (${player2elo} elo)`,
              description: `<@${result.match.discordId}> has been matched with <@${userId}>!\n\n
                Please read <#1426001621879357451> for instructions\n
                Use the buttons on this message to manage the game.`,
              color: 0x00ff00,
            },
          ],
          content: `<@${userId}>'s friend link: ${player1link}\n\n<@${result.match.discordId}>'s friend link: ${player2link}\n\n`,
          components: [row.toJSON()],
        });

        // Respond
        await interaction.reply({
          content: `✅ Match found! You have been paired with <@${result.match.discordId}> (Player Tag: ${result.match.playerTag}). Please coordinate with them to start your match.`,
          ephemeral: true,
        });
      } else {
        // No match yet, just queued
        await interaction.reply({
          content: `✅ ${result.message}`,
          ephemeral: true,
        });
        // DM user
        const user = await interaction.guild!.members.fetch(userId);
        await user.send({
          content: `You have been added to the queue! You will be matched with someone when possible. \n Please use this message as the most accurate reference to your queue status.`,
        });
      }
    } else {
      // Failure when queueing
      await interaction.reply({
        content: `❌ ${result.message}`,
        ephemeral: true,
      });
    }
  },
};
