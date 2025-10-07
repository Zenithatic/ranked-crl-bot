import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  COOLDOWN_TIMES,
  CooldownManager,
} from "../../utils/classes_types/cooldown";
import { setFriendLink } from "../../utils/db/registrationdb";
import { commandCheck } from "../../utils/functions/commandchecks";

const cooldown = new CooldownManager(COOLDOWN_TIMES.FIVE_MINUTES);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setfriendlink")
    .setDescription("Sets your Clash Royale friend link.")
    .addStringOption((option) =>
      option
        .setName("friendlink")
        .setDescription("Your Clash Royale friend link.")
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
    const res = await setFriendLink(userId, friendLink);

    if (!res) {
      await interaction.reply({
        content: "❌ Error updating friend link. Please contact an admin.",
        ephemeral: true,
      });
      return;
    }

    // Confirm success
    await interaction.reply({
      content: "✅ Your friend link has been updated successfully.",
      ephemeral: true,
    });
  },
};
