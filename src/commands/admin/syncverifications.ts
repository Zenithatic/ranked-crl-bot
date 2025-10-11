import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/commandchecks";
import { finishRegistration } from "../../utils/db/registrationdb";
dotenv.config();

// Create a cooldown manager for this command with 30-second cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.THIRTY_SECONDS);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("syncverifications")
    .setDescription("Force synchronize verifications for all users.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Allow only admins
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;
    const guild = interaction.guild!;

    // Fetch all members with verified users in the database
    const members = await guild.members.fetch();
    let successCount = 0;

    for (const member of members.values()) {
      const userId = member.user.id;
      const hasVerifiedRole = member.roles.cache.some(
        (role) => role.name === "Verified"
      );

      if (hasVerifiedRole) {
        const res = await finishRegistration(userId);
        if (!res) {
          console.error(
            `Failed to synchronize verification for user ID: ${userId}`
          );
        } else {
          successCount++;
        }
      }
    }

    // Send a response back to the user
    await interaction.reply({
      content: `Successfully synchronized verifications for ${successCount} users.`,
      ephemeral: true,
    });
  },
};
