// Imports
import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateUserData } from "@/src/utils/db/registrationdb";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resetelo")
    .setDescription("Force reset ELO for all users.")
    .addNumberOption((option) =>
      option
        .setName("elo")
        .setDescription("The ELO to reset all users to. Default is 1500.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Allow only admins
  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    // Defer reply to allow more time
    await interaction.deferReply({ ephemeral: true });

    const newElo = interaction.options.getNumber("elo") || 1500;

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

      // Process each verified member
      let successCount = 0;
      let processedCount = 0;
      const verifiedMembers = members.filter((m) =>
        m.roles.cache.some((role) => role.name === "Verified")
      );
      const totalMembers = verifiedMembers.size;

      for (const member of verifiedMembers.values()) {
        const userId = member.user.id;
        const res = await updateUserData(userId, { elo: newElo });

        if (!res) {
          console.error(`Failed to update elo for user ID: ${userId}`);
        } else {
          successCount++;
        }

        processedCount++;

        // Update progress every 10 users
        if (processedCount % 10 === 0) {
          await interaction.editReply({
            content: `Updating... ${processedCount}/${totalMembers} users elos processed.`,
          });
        }
      }

      // Final result
      await interaction.editReply({
        content: `✅ Updating complete! Successfully updated ${successCount} out of ${totalMembers} users' elos.`,
      });
    } catch (error) {
      console.error("Sync error:", error);
      await interaction.editReply({
        content: "❌ An error occurred during elo updating.",
      });
    }
  },
};
