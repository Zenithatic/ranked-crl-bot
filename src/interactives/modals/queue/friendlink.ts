import { ModalSubmitInteraction } from "discord.js";
import { setFriendLink } from "../../../utils/db/registrationdb";

module.exports = {
  customId: "friendlink-modal",
  async execute(interaction: ModalSubmitInteraction) {
    const userId = interaction.user.id;
    const friendLink =
      interaction.fields.getTextInputValue("friend-link-input");

    // Check for valid friend link if provided
    if (friendLink && friendLink.length > 0) {
      if (
        !friendLink.startsWith("https://link.clashroyale.com/invite/friend")
      ) {
        await interaction.reply({
          content:
            "❌ Invalid friend link. Please provide a valid Clash Royale friend link.",
          ephemeral: true,
        });
        return;
      }

      // Set friend link
      const res = await setFriendLink(userId, friendLink);

      if (!res) {
        await interaction.reply({
          content: "❌ Error updating friend link. Please contact an admin.",
          ephemeral: true,
        });
        return;
      }
    }
  },
};
