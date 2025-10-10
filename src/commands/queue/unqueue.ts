import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import { unqueuePlayer } from "../../utils/cache/queuecache";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/commandchecks";
dotenv.config();

// Create a cooldown manager for this command with 1-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unqueue")
    .setDescription("Leave the ranked queue.")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;
    const userId = interaction.user.id;

    // Set cooldown
    cooldown.setCooldown(userId);

    // Attempt to unqueue the user
    const result = await unqueuePlayer(userId);

    if (result.success) {
      // Remove "In Queue" role from both players
      const inQueueRole = interaction.guild!.roles.cache.find(
        (role) => role.name === "In Queue"
      );
      if (inQueueRole) {
        const member = await interaction.guild!.members.fetch(userId);
        await member.roles.remove(inQueueRole);
      }
      await interaction.reply({
        content: `✅ ${result.message}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ ${result.message}`,
        ephemeral: true,
      });
    }
  },
};
