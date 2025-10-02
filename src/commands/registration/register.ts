import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import { initiateRegistration } from "../../utils/db/registrationdb";
import { CooldownManager, COOLDOWN_TIMES } from "../../utils/classes/cooldown";
import { commandCheck } from "../../utils/functions/commandcheck";
dotenv.config();
const token = process.env.API_TOKEN;

// Create a cooldown manager for this command with 5-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.FIVE_MINUTES);

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
    const isValid = await commandCheck(interaction, cooldown, false);
    if (!isValid) return;

    const userId = interaction.user.id;

    // Check if user is already registered via discord roles
    const roles = interaction.member?.roles;
    if (roles && roles instanceof Object && "cache" in roles) {
      const roleCache = roles.cache;
      const isRegistered = roleCache.some((role) =>
        ["Verified", "Admin", "Moderator"].includes(role.name)
      );
      if (isRegistered) {
        await interaction.reply({
          content:
            "❌ You are already registered. If you need to update your registration, please contact an admin.",
          ephemeral: true,
        });
        return;
      }
    }

    // Extract Player Tag
    const playerTag = interaction.options.getString("playertag");
    if (!playerTag) {
      await interaction.reply("Please provide a valid player tag.");
      return;
    }

    // Validate with Clash Royale API
    const response = await fetch(
      "https://api.clashroyale.com/v1/players/%23" + playerTag,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

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
        content: `Please switch your main TROPHY ROAD deck to the following deck for verification, <@${
          interaction.user.id
        }>:\nhttps://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${cardsCopy
          .map((card) => card)
          .join(
            ";"
          )}&ev=117751&id=${playerTag}&l=Default_Event&slots=1;1;1;1;1;1;1;1&tt=159000000\n\nThe deck may take a long time to be detected for verification. Run /verify every 10 minutes until it is successful.`,
        ephemeral: true,
      });

      // Set cooldown after successful execution
      cooldown.setCooldown(userId);
    } else {
      interaction.reply({
        content:
          "Failed to fetch player data. Please ensure your player tag is correct and try again.",
        ephemeral: true,
      });
      console.error("Error fetching player data:", response);
    }
  },
};
