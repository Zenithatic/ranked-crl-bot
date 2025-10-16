import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  COOLDOWN_TIMES,
  CooldownManager,
} from "../../utils/classes_types/cooldown";
import { updateUserData } from "../../utils/db/registrationdb";
import { commandCheck } from "../../utils/functions/interactionchecks";

const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setfriendlink")
    .setDescription("Sets your Clash Royale friend link. (Expires in 24h)")
    .addStringOption((option) =>
      option
        .setName("friendlink")
        .setDescription("Your Clash Royale friend link (expires in 24h).")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;

    const userId = interaction.user.id;
    const friendLink = interaction.options.getString("friendlink");

    // Set cooldown
    cooldown.setCooldown(userId);

    // Check for valid friend link
    if (
      !friendLink ||
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

    // Confirm success
    await interaction.reply({
      content:
        "✅ Your friend link has been updated successfully. Note that it expires in 24 hours.",
      ephemeral: true,
    });
  },
};
