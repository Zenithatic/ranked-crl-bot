import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  getPlayerCountFromDB,
  getUserData,
  getPlayerRank,
} from "../../utils/db/registrationdb";
import { commandCheck } from "../../utils/functions/commandchecks";
import {
  COOLDOWN_TIMES,
  CooldownManager,
} from "../../utils/classes_types/cooldown";

const cooldown = new CooldownManager(COOLDOWN_TIMES.TEN_SECONDS);

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
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, false))) return;

    // Fetch user profile information from the database
    const userId =
      interaction.options.getUser("user")?.id || interaction.user.id;
    const userData = await getUserData(userId);
    const discordUser = interaction.options.getUser("user") || interaction.user;
    const guildMember = await interaction.guild!.members.fetch(userId);

    if (!userData) {
      await interaction.reply({
        content: "❌ Error retrieving user profile information.",
        ephemeral: true,
      });
      return;
    }

    // Get player ranking
    const ranking = await getPlayerRank(userId);

    await interaction.reply({
      embeds: [
        {
          title: `Profile: ${guildMember.displayName}`,
          fields: [
            { name: "Elo", value: `${userData.elo}`, inline: true },
            { name: "Wins", value: `${userData.wins}`, inline: true },
            { name: "Losses", value: `${userData.losses}`, inline: true },
            {
              name: "Rank",
              value: ranking
                ? `${ranking.rank} / ${ranking.totalPlayers}`
                : "N/A",
              inline: true,
            },
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

    // Set cooldown after successful execution
    cooldown.setCooldown(interaction.user.id);
  },
};
