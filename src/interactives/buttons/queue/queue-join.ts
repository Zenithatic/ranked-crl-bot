// Imports
import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "@/src/utils/classes_types/cooldown";
import { buttonCheck } from "@/src/utils/functions/interactionchecks";

// Create a cooldown manager for this button with 30-second cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.THIRTY_SECONDS);

module.exports = {
  customId: "queue-join",
  async execute(interaction: ButtonInteraction) {
    const userId = interaction.user.id;
    // Check if button is used validly
    if (!(await buttonCheck(interaction, cooldown, true))) return;
    // Set cooldown
    cooldown.setCooldown(userId);

    // Show modal to prompt for optional friend link
    const modal = new ModalBuilder()
      .setCustomId("queue-friendlink-modal")
      .setTitle("Join Queue");
    const friendInput = new TextInputBuilder()
      .setCustomId("friend-link-input")
      .setLabel("Friend link (optional) (expires in 24h)")
      .setPlaceholder("https://example.com/your-profile")
      .setRequired(false)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(friendInput)
    );
    await interaction.showModal(modal);
  },
};
