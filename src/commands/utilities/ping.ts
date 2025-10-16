// Imports
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Calculate ping
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! Latency is ${ping}ms`);
  },
};
