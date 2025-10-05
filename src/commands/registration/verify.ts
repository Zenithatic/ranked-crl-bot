import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  COOLDOWN_TIMES,
  CooldownManager,
} from "../../utils/classes_types/cooldown";
import { fetchRegistration } from "../../utils/db/registrationdb";
import {
  commandCheck,
  verifiedCheck,
} from "../../utils/functions/commandchecks";
import { getBattleLogs, getPlayer } from "../../utils/data/api";

const cooldown = new CooldownManager(COOLDOWN_TIMES.FIVE_MINUTES);

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
    if (await verifiedCheck(interaction)) {
      await interaction.reply({
        content:
          "❌ You are already registered. If you need to update your registration, please contact an admin.",
        ephemeral: true,
      });
      return;
    }

    // Attempt to fetch registration deck from DB
    const registration = await fetchRegistration(userId);
    if (registration === null) {
      await interaction.reply({
        content:
          "❌ No registration deck found. Please use /register to start the process.",
        ephemeral: true,
      });
      return;
    }

    const deckList = registration.deckList;
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
