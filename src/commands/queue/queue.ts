import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import { queuePlayer } from "../../utils/cache/queuecache";
import { CooldownManager, COOLDOWN_TIMES } from "../../utils/classes/cooldown";
import { commandCheck } from "../../utils/functions/commandcheck";
dotenv.config();

// Create a cooldown manager for this command with 1-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Enter the ranked queue to be matched with other players.")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    const isValid = await commandCheck(interaction, cooldown, true);
    if (!isValid) return;

    // Attempt to queue the user
    const userId = interaction.user.id;
    const result = await queuePlayer(userId);

    if (result.success) {
      if (result.match) {
        // match logic
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

    // Set cooldown after successful execution
    cooldown.setCooldown(userId);
  },
};
