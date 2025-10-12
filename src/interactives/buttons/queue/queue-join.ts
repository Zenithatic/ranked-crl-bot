import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../../utils/classes_types/cooldown";
import { buttonCheck } from "../../../utils/functions/interactionchecks";
import { queuePlayer } from "../../../utils/cache/queuecache";
import { getUserData } from "../../../utils/db/registrationdb";

// Create a cooldown manager for this command with 30-second cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.THIRTY_SECONDS);

const matchChannelCategory = "1421362444382507049";

module.exports = {
  customId: "queue-join",
  async execute(interaction: ButtonInteraction) {
    const userId = interaction.user.id;
    // Check if button is used validly
    if (!(await buttonCheck(interaction, cooldown, true))) return;
    // Set cooldown
    cooldown.setCooldown(userId);

    // Show modal to prompt for optional friend link
    const modal = new ModalBuilder()
      .setCustomId("friendlink-modal")
      .setTitle("Join Queue");
    const friendInput = new TextInputBuilder()
      .setCustomId("friend-link-input")
      .setLabel("Enter your friend link (optional)")
      .setPlaceholder("https://example.com/your-profile")
      .setRequired(false)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(friendInput)
    );
    await interaction.showModal(modal);

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

        // player tags and elos
        const playertag1 = player1data.playerTag;
        const playertag2 = player2data.playerTag;
        const player1elo = player1data.elo;
        const player2elo = player2data.elo;

        // create private channel only for the two players to discuss
        const newchannel = await interaction.guild!.channels.create({
          name: `match-${userId}-${result.match.discordId}`,
          type: ChannelType.GuildText,
          parent: matchChannelCategory,
          topic: `time-${Date.now()}`,
        });

        // get Verified role
        const verifiedRole = interaction.guild!.roles.cache.find(
          (role) => role.name === "Verified"
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
          {
            id: interaction.guild!.roles.cache.find(
              (role) => role.name === "Mod"
            )!.id, // allow mods
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
                Please read <#1426001621879357451> for instructions`,
              color: 0x00ff00,
            },
          ],
          content: `<@${userId}>'s friend link: ${player1link}\n\n<@${result.match.discordId}>'s friend link: ${player2link}\n\n`,
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
  },
};
