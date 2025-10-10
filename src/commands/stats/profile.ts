import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getUserData } from "../../utils/db/registrationdb";
import { stringify } from "querystring";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Displays RankedCRL user profile information.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to view the profile of.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Fetch user profile information from the database
    const userId =
      interaction.options.getUser("user")?.id || interaction.user.id;
    const userData = await getUserData(userId);
    const discordUser = interaction.options.getUser("user") || interaction.user;

    if (!userData) {
      await interaction.reply({
        content: "❌ Error retrieving user profile information.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        {
          title: `Profile: ${discordUser.displayName} with player tag #${userData.playerTag}`,
          fields: [
            { name: "Elo", value: `${userData.elo}`, inline: true },
            { name: "Wins", value: `${userData.wins}`, inline: true },
            { name: "Losses", value: `${userData.losses}`, inline: true },
            {
              name: "Win Streak",
              value: `${userData.win_streak}`,
              inline: true,
            },
            // Implement last game later
            { name: "Friend Link", value: userData.friend_link, inline: true },
          ],
          color: 0x0099ff,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  },
};
