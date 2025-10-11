import { EmbedBuilder, TextChannel } from "discord.js";
import { fetchTopPlayers } from "../db/registrationdb";

async function printLeaderboard(channel: TextChannel) {
  // Fetch and format leaderboard data
  const lbdata = await fetchTopPlayers(25);
  if (!lbdata || lbdata.length === 0) {
    await channel.send("No verified players found for the leaderboard.");
    return;
  }

  let leaderboardEmbed = new EmbedBuilder()
    .setTitle("🏆 Ranked CRL Leaderboard 🏆")
    .setColor("#FFD700");

  let description = "Top 25 Players:\n\n";
  lbdata.forEach((player, index) => {
    const rank = `${index + 1}.`.padEnd(4, ' ');
    const elo = player.elo.toString().padEnd(5);
    description += `${rank} ELO - ${elo}: <@${player.id}>\n`;
  });
  leaderboardEmbed.setDescription(description);

  await channel.send({ embeds: [leaderboardEmbed] });
}

export { printLeaderboard };
