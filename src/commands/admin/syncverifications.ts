import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/interactionchecks";
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

    // defer
    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch all members with verified users in the database
      const members = await guild.members
        .fetch({ time: 30000 })
        .catch(() => null);

      if (!members) {
        await interaction.editReply({
          content:
            "❌ Failed to fetch guild members. The server may be too large.",
        });
        return;
      }

      let successCount = 0;
      let processedCount = 0;
      const verifiedMembers = members.filter((m) =>
        m.roles.cache.some((role) => role.name === "Verified")
      );
      const totalMembers = verifiedMembers.size;

      for (const member of verifiedMembers.values()) {
        const userId = member.user.id;
        const res = await finishRegistration(userId);

        if (!res) {
          console.error(
            `Failed to synchronize verification for user ID: ${userId}`
          );
        } else {
          successCount++;
        }

        processedCount++;

        // update progress every 10 users
        if (processedCount % 10 === 0) {
          await interaction.editReply({
            content: `Synchronizing... ${processedCount}/${totalMembers} verified users processed.`,
          });
        }
      }

      // final result
      await interaction.editReply({
        content: `✅ Synchronization complete! Successfully synced ${successCount} out of ${totalMembers} verified users.`,
      });
    } catch (error) {
      console.error("Sync error:", error);
      await interaction.editReply({
        content: "❌ An error occurred during synchronization.",
      });
    }
  },
};
