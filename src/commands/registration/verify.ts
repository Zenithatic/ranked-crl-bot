import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { COOLDOWN_TIMES, CooldownManager } from "../../utils/cooldown";
import { fetchRegistration } from "../../utils/registrationdb";

const registerCooldown = new CooldownManager(COOLDOWN_TIMES.FIVE_MINUTES);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verifies your Clash Royale account by checking your deck.")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used in a guild (server)
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ This command can only be used in a server, not in DMs.",
        ephemeral: true,
      });
      return;
    }

    // Check cooldown
    const userId = interaction.user.id;
    const cooldownCheck = registerCooldown.checkCooldown(userId);

    if (cooldownCheck.isOnCooldown) {
      await interaction.reply({
        content: `⏰ You can use this command again in ${cooldownCheck.timeLeft} minute(s).`,
        ephemeral: true,
      });
      return;
    }

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

    // Attempt to fetch registration deck from DB
    const registration = await fetchRegistration(userId);
    const deckList = registration?.deckList;
    const playerTag = registration?.playerTag;

    if (registration === null) {
      await interaction.reply({
        content:
          "❌ No registration deck found. Please use /register to start the process.",
        ephemeral: true,
      });
      return;
    }

    // Fetch player's current deck from Clash Royale API
    const token = process.env.API_TOKEN;
    const response = await fetch(
      "https://api.clashroyale.com/v1/players/%23" + playerTag,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      await interaction.reply({
        content: "❌ Failed to fetch your current deck from Clash Royale.",
        ephemeral: true,
      });
      console.error("Error fetching player data:", response);
      return;
    }

    const playerData = await response.json();
    const currentDeck = playerData.currentDeck.map((card: any) => card.id);

    // Compare decks
    const isMatch = deckList.every((cardId: any) =>
      currentDeck.includes(cardId)
    );

    if (isMatch) {
      // Give user verified role and change their discord name to ign name + tag
      const member = await interaction.guild.members.fetch(userId);
      const verifiedRole = interaction.guild.roles.cache.find(
        (role) => role.name === "Verified"
      );

      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }

      const newNickname = `${playerData.name} (#${playerData.tag.replace(
        "#",
        ""
      )})`;
      try {
        await member.setNickname(newNickname);
      } catch (error) {
        console.error("Error setting nickname:", error);
      }

      await interaction.reply({
        content: "✅ Verification successful! Your account is now verified.",
        ephemeral: true,
      });
      // Optionally, remove the registration deck from DB after successful verification
    } else {
      await interaction.reply({
        content:
          "❌ Verification failed. Your current deck does not match the registration deck. Please ensure you have switched to the correct deck on TROPHY ROAD and try again in a few minutes.",
        ephemeral: true,
      });
    }
  },
};
