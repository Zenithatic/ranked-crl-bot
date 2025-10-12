import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  COOLDOWN_TIMES,
  CooldownManager,
} from "../../utils/classes_types/cooldown";
import { finishRegistration, getUserData } from "../../utils/db/registrationdb";
import {
  commandCheck,
  cmdVerifiedCheck,
} from "../../utils/functions/interactionchecks";
import { getBattleLogs } from "../../utils/data/api";

const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verifies your Clash Royale account by checking your deck.")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, false))) return;

    const userId = interaction.user.id;

    // Check if user is already verified via discord roles
    if (await cmdVerifiedCheck(interaction)) {
      await interaction.reply({
        content:
          "❌ You are already registered. If you need to update your registration, please contact an admin.",
        ephemeral: true,
      });
      return;
    }

    // Set cooldown
    cooldown.setCooldown(userId);

    // Attempt to fetch registration deck from DB
    const registration = await getUserData(userId);
    if (registration === null) {
      await interaction.reply({
        content:
          "❌ No registration deck found. Please use /register to start the process.",
        ephemeral: true,
      });
      return;
    }

    const deckList = JSON.parse(registration.deckList);
    const playerTag = registration.playerTag;

    // Fetch player's battle log from Clash Royale API
    const response = await getBattleLogs(playerTag);

    if (!response.ok) {
      await interaction.reply({
        content: "❌ Failed to fetch your battle log from Clash Royale.",
        ephemeral: true,
      });
      console.error("Error fetching player data:", response);
      return;
    }

    const playerData = await response.json();
    const currentDeck = playerData[0].team[0].cards.map((card: any) => card.id);

    // Compare decks
    const isMatch = deckList.every((cardId: any) =>
      currentDeck.includes(cardId)
    );

    if (isMatch) {
      // Give user verified role and change their discord name to ign name + tag
      const member = await interaction.guild!.members.fetch(userId);
      const verifiedRole = interaction.guild!.roles.cache.find(
        (role) => role.name === "Verified"
      );

      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }

      const newNickname = `${playerData[0].team[0].name} (#${playerTag})`;
      try {
        await member.setNickname(newNickname);
      } catch (error) {
        console.error("Error setting nickname:", error);
      }

      const res = await finishRegistration(userId);
      if (!res) {
        await interaction.reply({
          content:
            "❌ An error occurred while finalizing your registration. Please contact an admin.",
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: "✅ Verification successful! Your account is now verified.",
        ephemeral: true,
      });
      // Optionally, remove the registration deck from DB after successful verification
    } else {
      await interaction.reply({
        content:
          "❌ Verification failed. Your latest battle does not show that you used the registration deck. Please ensure you have played a classic 1v1 with the deck and try again in a few minutes.",
        ephemeral: true,
      });
    }
  },
};
