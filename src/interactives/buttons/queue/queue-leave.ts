// Imports
import { ButtonInteraction } from "discord.js";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../../utils/classes_types/cooldown";
import { buttonCheck } from "../../../utils/functions/interactionchecks";
import { unqueuePlayer } from "../../../utils/cache/queuecache";

// Create a cooldown manager for this command with thirty-second cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.THIRTY_SECONDS);

module.exports = {
  customId: "queue-leave",
  async execute(interaction: ButtonInteraction) {
    const userId = interaction.user.id;
    // Check if button is used validly
    if (!(await buttonCheck(interaction, cooldown, true))) return;
    // Set cooldown
    cooldown.setCooldown(userId);

    // Attempt to unqueue the user
    const result = await unqueuePlayer(userId);

    // Notify user of result
    if (result.success) {
      await interaction.reply({
        content: `✅ ${result.message}`,
        ephemeral: true,
      });
      // DM user
      const user = await interaction.guild!.members.fetch(userId);
      await user.send({
        content: `You have been removed from the queue. You will no longer be matched with someone when possible. \n Please use this message as the most accurate reference to your queue status.`,
      });
    } else {
      await interaction.reply({
        content: `❌ ${result.message}`,
        ephemeral: true,
      });
    }
  },
};
