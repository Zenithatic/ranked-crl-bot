// Imports
import { Client, GatewayIntentBits, Collection, TextChannel } from "discord.js";
import dotenv from "dotenv";
dotenv.config();
import fs from "node:fs";
import path from "node:path";
import { printLeaderboard } from "./utils/functions/printleaderboard";

// Create a new client instance with necessary intents (basically permissions)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// Create a global collection to store commands
const commands = new Collection<string, any>();

// Load commands from the commands directory
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
      commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

// Client ready event
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  // Leaderboard loop every 12 hours
  const leaderboardchannelid = "1421366223144226867";
  const leaderboardchannel = client.channels.cache.get(
    leaderboardchannelid
  ) as TextChannel;
  await printLeaderboard(leaderboardchannel);
  setInterval(async () => {
    if (!leaderboardchannel) return;

    await printLeaderboard(leaderboardchannel);
  }, 60 * 60 * 12 * 1000);
});

// Handle slash command interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.on("messageCreate", (message) => {
  if (message.content === "!ping") {
  }
});

client.login(process.env.TOKEN);
