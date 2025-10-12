import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { fetchTopPlayers } from "../db/registrationdb";

async function printLeaderboard(client: Client) {
  const leaderboardchannelid = "1421366223144226867";
  const channel = client.channels.cache.get(
    leaderboardchannelid
  ) as TextChannel;

  // Delete all previous messages in channel
  const messages = await channel.messages.fetch({ limit: 10 });
  for (const message of messages.values()) {
    await message.delete().catch(() => null);
  }

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
    const rank = `${index + 1}.`.padEnd(4, "\u00A0");
    const elo = player.elo.toString().padEnd(5, "\u00A0");
    description += `${rank}ELO - ${elo}: <@${player.id}>\n`;
  });
  leaderboardEmbed.setDescription(description);

  await channel.send({ embeds: [leaderboardEmbed] });
}

export { printLeaderboard };
