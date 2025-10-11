import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import { initiateRegistration } from "../../utils/db/registrationdb";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import {
  commandCheck,
  verifiedCheck,
} from "../../utils/functions/commandchecks";
import { getPlayer } from "../../utils/data/api";
dotenv.config();

// Create a cooldown manager for this command with 1-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription(
      "Register CR account. Generates a deck for you to switch to for verification."
    )
    .addStringOption((option) =>
      option
        .setName("playertag")
        .setDescription("Your Clash Royale player tag (WITHOUT #).")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, false))) return;

    const userId = interaction.user.id;

    // Check if user is already verified via discord roles
    if (await verifiedCheck(interaction)) {
      await interaction.reply({
        content:
          "❌ You are already registered. If you need to update your registration, please contact an admin.",
        ephemeral: true,
      });
      return;
    }

    // Extract Player Tag
    let playerTag = interaction.options.getString("playertag");
    if (!playerTag) {
      await interaction.reply("Please provide a valid player tag.");
      return;
    }
    // remove leading # if present
    if (playerTag.startsWith("#")) {
      playerTag = playerTag.substring(1);
    }

    // Set cooldown after successful execution
    cooldown.setCooldown(userId);

    // Validate with Clash Royale API
    const response = await getPlayer(playerTag);

    // If valid player tag
    if (response.ok) {
      // Generate a deck with cards
      const cardsCopy = await initiateRegistration(playerTag, userId);
      if (cardsCopy === null) {
        await interaction.reply({
          content:
            "Failed to generate a deck. Your discord or Clash Royale account may already be registered.",
          ephemeral: true,
        });
        return;
      }

      // Reply with deck link
      await interaction.reply({
        content: `Please play a game (any 1v1 game works - classic is the most convenient) with the following deck for verification, <@${
          interaction.user.id
        }>:\nhttps://link.clashroyale.com/en?clashroyale://copyDeck?deck=${cardsCopy
          .map((card) => card)
          .join(
            ";"
          )}&slots=0;0;0;0;0;0;0;0&tt=159000000&l=Royals&id=2QRJ89LVV\n\nAfter, please run /verify to complete the verification process. `,
        ephemeral: true,
      });
    } else {
      // Error in response
      interaction.reply({
        content:
          "Failed to fetch player data. Please ensure your player tag is correct and try again.",
        ephemeral: true,
      });
      console.error("Error fetching player data:", response);
    }
  },
};
