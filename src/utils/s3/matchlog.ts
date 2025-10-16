// Imports
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { TextChannel } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});
const BUCKET_NAME = "rankedcrl-match-channel-logs";

/**
 * Log a match channel's details to rankedcrl-match-channel-logs S3
 * @param channel: The Discord text channel to log
 */
async function logMatchChannel(channel: TextChannel): Promise<boolean> {
  // Specify the folder for the day the channel was created
  const date = channel.createdAt;
  const year = date.getFullYear();
  const month = date.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const day = date.getDate().toString().padStart(2, "0");
  const dateFolder = `matches/${year}_${month}_${day}/`;

  // Fetch player IDs from channel name
  const channelname = channel.name;
  const player1id = channelname.split("-")[1];
  const player2id = channelname.split("-")[2];

  // Fetch in-guild players
  const player1 = await channel.guild.members
    .fetch(player1id)
    .catch(() => null);
  const player2 = await channel.guild.members
    .fetch(player2id)
    .catch(() => null);

  // Fetch channel messages and filter out bot messages
  const messages = await channel.messages.fetch();
  const sortedMessages = messages
    .filter((message) => !message.author.bot)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // Prepare log data as .txt
  let logData = `Match Channel Log: ${channel.name}\n`;
  logData += `Created At: ${channel.createdAt.toISOString()}\n`;
  logData += `Players: <@${player1id}> (${player1?.displayName || ""})`;
  logData += `vs <@${player2id}> (${player2?.displayName || ""})\n`;
  logData += `\nMessages:\n\n`;

  for (const [, message] of sortedMessages) {
    logData += `- [${message.createdAt.toISOString()}] ${message.author.id}: ${
      message.content
    }\n`;
  }

  // Upload log data to S3
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${dateFolder}match-${channel.id}-log.txt`,
        Body: logData,
        ContentType: "text/plain",
      })
    );
    console.log(
      `Successfully uploaded log to S3: ${dateFolder}match-${channel.id}-log.txt`
    );
  } catch (error) {
    console.error(
      `Error uploading log to S3: ${dateFolder}match-${channel.id}-log.txt`,
      error
    );
    return false;
  }

  return true;
}

export { logMatchChannel };
