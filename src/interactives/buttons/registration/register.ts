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
import {
  buttonCheck,
  btnVerifiedCheck,
} from "@/src/utils/functions/interactionchecks";

// Create a cooldown manager for this command with one-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

module.exports = {
  customId: "register",
  async execute(interaction: ButtonInteraction) {
    const userId = interaction.user.id;
    // Check if button is used validly
    if (!(await buttonCheck(interaction, cooldown, false))) return;
    // Set cooldown
    cooldown.setCooldown(userId);

    // Check if user is already verified via discord roles
    if (await btnVerifiedCheck(interaction)) {
      await interaction.reply({
        content:
          "❌ You are already registered. If you need to update your registration, please contact an admin.",
        ephemeral: true,
      });
      return;
    }

    // Show registration modal
    const modal = new ModalBuilder()
      .setCustomId("registration-modal")
      .setTitle("Registration");
    const playerTagInput = new TextInputBuilder()
      .setCustomId("player-tag-input")
      .setLabel("Enter your player tag")
      .setPlaceholder("#ABCD1234")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(playerTagInput)
    );

    await interaction.showModal(modal);
  },
};
