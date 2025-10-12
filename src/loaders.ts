import fs from "fs";
import path from "path";
import { Collection } from "discord.js";

function loadCommands() {
  const commands = new Collection<string, any>();
  // Load commands from the commands directory
  const cmdFoldersPath = path.join(__dirname, "commands");
  const commandFolders = fs.readdirSync(cmdFoldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(cmdFoldersPath, folder);
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

  return commands;
}

function loadButtons() {
  const buttons = new Collection<string, any>();
  // Load buttons from the buttons directory
  const btnFoldersPath = path.join(__dirname, "interactives/buttons");
  const buttonFolders = fs.readdirSync(btnFoldersPath);

  for (const folder of buttonFolders) {
    const buttonsPath = path.join(btnFoldersPath, folder);
    const buttonFiles = fs
      .readdirSync(buttonsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of buttonFiles) {
      const filePath = path.join(buttonsPath, file);
      const interactive = require(filePath);

      if ("customId" in interactive && "execute" in interactive) {
        buttons.set(interactive.customId, interactive);
      } else {
        console.log(
          `[WARNING] The button at ${filePath} is missing a required "customId" or "execute" property.`
        );
      }
    }
  }

  return buttons;
}

function loadModals() {
  const modals = new Collection<string, any>();
  // Load modals from the modals directory
  const modalFoldersPath = path.join(__dirname, "interactives/modals");
  const modalFolders = fs.readdirSync(modalFoldersPath);

  for (const folder of modalFolders) {
    const modalsPath = path.join(modalFoldersPath, folder);
    const modalFiles = fs
      .readdirSync(modalsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of modalFiles) {
      const filePath = path.join(modalsPath, file);
      const interactive = require(filePath);

      if ("customId" in interactive && "execute" in interactive) {
        modals.set(interactive.customId, interactive);
      } else {
        console.log(
          `[WARNING] The modal at ${filePath} is missing a required "customId" or "execute" property.`
        );
      }
    }
  }

  return modals;
}

export { loadCommands, loadButtons, loadModals };
