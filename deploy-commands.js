// Imports
const { REST, Routes } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();
const token = process.env.TOKEN;
const guildId = process.env.GUILD_ID;
const clientId = process.env.CLIENT_ID;
const fs = require('node:fs');
const path = require('node:path');

// Constants
const commandFolderPath = "build/commands";

// Command list to hold all the commands to deploy
const commands = [];

// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, commandFolderPath);
const commandFolders = fs.readdirSync(foldersPath);

// Loop through all the command folders and grab command files
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath);

	// Grab the JSON output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

    // Verify that the required properties exist on the command
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// Deploy commands
async function deployCommands() {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
}

deployCommands();