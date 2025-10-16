// Imports
import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { emptyQueue } from "@/src/utils/cache/queuecache";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearqueue")
    .setDescription("Clear all users from queue.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Allow only admins
  async execute(interaction: ChatInputCommandInteraction) {
    // Empty users
    const emptiedUsers = await emptyQueue();
    // Notify users that the queue has been emptied
    for (const user of emptiedUsers) {
      const id = JSON.parse(user).id;
      const member = await interaction.guild?.members.fetch(id);
      if (member) {
        await member.send(
          "Your place in the queue has been cleared from the hourly reset. Please rejoin the queue if you wish to be matched."
        );
      }
    }
  },
};
