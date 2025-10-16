// Imports
import { ModalSubmitInteraction } from "discord.js";
import { initiateRegistration } from "../../../utils/db/registrationdb";
import { getPlayer } from "../../../utils/data/api";

module.exports = {
  customId: "registration-modal",
  async execute(interaction: ModalSubmitInteraction) {
    // Extract user id and player tag from modal input
    const userId = interaction.user.id;
    let playerTag = interaction.fields.getTextInputValue("player-tag-input");

    // remove leading # if present
    if (playerTag.startsWith("#")) {
      playerTag = playerTag.substring(1);
    }

    // Validate with Clash Royale API
    const response = await getPlayer(playerTag);

    // If valid player tag
    if (response.ok) {
      // Generate a deck with cards
      const cardsCopy = await initiateRegistration(playerTag, userId);
      if (cardsCopy === null) {
        await interaction.reply({
          content:
            "Failed to generate a deck. Your discord or Clash Royale account may already be registered.",
          ephemeral: true,
        });
        return;
      }

      // Reply with deck link
      await interaction.reply({
        content: `Please play a game (any 1v1 game works - classic is the most convenient) with the following deck for verification, <@${
          interaction.user.id
        }>:\nhttps://link.clashroyale.com/en?clashroyale://copyDeck?deck=${cardsCopy
          .map((card) => card)
          .join(
            ";"
          )}&slots=0;0;0;0;0;0;0;0&tt=159000000&l=Royals&id=2QRJ89LVV\n\nAfter, please run /verify to complete the verification process. `,
        ephemeral: true,
      });
    } else {
      // Error in response
      interaction.reply({
        content:
          "Failed to fetch player data. Please ensure your player tag is correct and try again.",
        ephemeral: true,
      });
      console.error("Error fetching player data:", response);
    }
  },
};
