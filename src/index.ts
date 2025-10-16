// Imports
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

import { loadButtons, loadCommands, loadModals } from "./loaders";
import { printLeaderboard } from "./utils/functions/printleaderboard";
import { emptyQueue } from "./utils/cache/queuecache";

dotenv.config();

// Create a new client instance with necessary intents (basically permissions)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// Load commands and interactives
const commands = loadCommands();
const buttons = loadButtons();
const modals = loadModals();

// Client ready event
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  // Leaderboard loop every 12 hours
  await printLeaderboard(client);
  setInterval(async () => {
    await printLeaderboard(client);
  }, 60 * 60 * 12 * 1000);

  // Clear queue every hour and notify users
  setInterval(async () => {
    const emptiedUsers = await emptyQueue();
    // Notify users that the queue has been emptied
    for (const user of emptiedUsers) {
      const id = JSON.parse(user).discordId;
      const member = await client.guilds.cache
        .get(process.env.GUILD_ID!)
        ?.members.fetch(id)
        .catch(() => null);
      if (member) {
        await member.send(
          "Your place in the queue has been cleared from the hourly reset. Please rejoin the queue if you wish to be matched."
        );
      }
    }
  }, 60 * 60 * 1 * 1000);
});

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  // Handle Chat commands
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
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
  }

  // Handle buttons
  else if (interaction.isButton()) {
    const button = buttons.get(interaction.customId);

    if (!button) {
      console.error(`No button matching ${interaction.customId} was found.`);
      return;
    }

    try {
      await button.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this button!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this button!",
          ephemeral: true,
        });
      }
    }
  }

  // Handle modals
  else if (interaction.isModalSubmit()) {
    const modal = modals.get(interaction.customId);

    if (!modal) {
      console.error(`No modal matching ${interaction.customId} was found.`);
      return;
    }

    try {
      await modal.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this modal!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this modal!",
          ephemeral: true,
        });
      }
    }
  }
});

// Message create event
// client.on("messageCreate", (message) => {
//
// });

client.login(process.env.TOKEN);
