import { ChatInputCommandInteraction } from "discord.js";
import { CooldownManager } from "../classes/cooldown";

async function commandCheck(
  interaction: ChatInputCommandInteraction,
  cooldownManager: CooldownManager,
  requireVerified = false
) {
  // Check if command is used in a guild (server)
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command can only be used in a server, not in DMs.",
      ephemeral: true,
    });
    return false;
  }

  // Check cooldown
  const userId = interaction.user.id;
  const cooldownCheck = cooldownManager.checkCooldown(userId);

  if (cooldownCheck.isOnCooldown) {
    await interaction.reply({
      content: `⏰ You can use this command again in ${cooldownCheck.timeLeft} minute(s).`,
      ephemeral: true,
    });
    return false;
  }

  // Check for verification role
  if (requireVerified) {
    const roles = interaction.member?.roles;
    if (roles && roles instanceof Object && "cache" in roles) {
      const roleCache = roles.cache;
      const isVerified = roleCache.some((role) =>
        ["Verified"].includes(role.name)
      );
      if (!isVerified) {
        await interaction.reply({
          content:
            "❌ You must be verified to use this command. Please complete the verification process using /verify.",
          ephemeral: true,
        });
        return false;
      }
    }
  }

  // All checks passed
  return true;
}
export { commandCheck };
