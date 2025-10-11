import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { queuePlayer } from "../../utils/cache/queuecache";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/commandchecks";
import { getUserData, setFriendLink } from "../../utils/db/registrationdb";
dotenv.config();

// Create a cooldown manager for this command with 1-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

const matchChannelCategory = "1421362444382507049";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Enter the ranked queue to be matched with other players.")
    .addStringOption((option) =>
      option
        .setName("friendlink")
        .setDescription("Your Clash Royale friend link (expires in 24h).")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;

    // Set cooldown after successful execution
    const userId = interaction.user.id;
    cooldown.setCooldown(userId);

    // Check if friendlink is specified
    const friendLink = interaction.options.getString("friendlink");

    // Check for valid friend link if provided
    if (friendLink) {
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
      const res = await setFriendLink(userId, friendLink);

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
