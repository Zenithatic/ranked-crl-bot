import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import dotenv from "dotenv";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/commandchecks";
import { getUserData, persistBattleLog } from "../../utils/db/registrationdb";
import { getBattleLogs } from "../../utils/data/api";
import { calculateEloChange } from "../../utils/functions/elocalc";
import { BattleLog } from "../../utils/classes_types/BattleLog";
dotenv.config();

// Create a cooldown manager for this command with 1-minute cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.ONE_MINUTE);

const battleLogChannel = "1424129349019242597";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("finishgame")
    .setDescription("Evaluate the current ranked game.")
    .setDefaultMemberPermissions(null), // Allow all users to use this command
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if command is used validly
    if (!(await commandCheck(interaction, cooldown, true))) return;

    // Check if channel is a match channel
    if (
      !interaction.channel ||
      interaction.channel.type !== ChannelType.GuildText ||
      !interaction.channel.name ||
      !interaction.channel.name.startsWith("match-")
    ) {
      await interaction.reply({
        content:
          "❌ This command can only be used in a match channel created when you were paired with an opponent.",
        ephemeral: true,
      });
      return;
    }

    const userId = interaction.user.id;
    const player1id = interaction.channel.name.split("-")[1];
    const player2id = interaction.channel.name.split("-")[2];
    const player1data = await getUserData(player1id);
    const player2data = await getUserData(player2id);

    if (!player1data || !player2data) {
      await interaction.reply({
        content: "❌ Error retrieving player data. Please contact an admin.",
        ephemeral: true,
      });
      return;
    }

    // Check clash royale API for player 1's battle logs
    const player1logs = await getBattleLogs(player1data.playerTag);
    if (!player1logs.ok) {
      await interaction.reply({
        content: `❌ Failed to fetch battle logs for <@${player1id}>. Please contact an admin.`,
      });
      return;
    }

    // Set cooldown after successful execution
    cooldown.setCooldown(userId);

    const player1battles = await player1logs.json();
    let battles: BattleLog[] = [];
    let player1wins = 0;
    let player2wins = 0;
    const maxBattlesToCheck = 3; // Check the last 3 battles
    let battlesProcessed = 0;

    for (const battle of player1battles) {
      if (battle.opponent[0].tag != "#" + player2data.playerTag) {
        interaction.reply({
          content: `❌ One of the recent battles for <@${player1id}> is not against <@${player2id}>.`,
        });
        return;
      }

      if (battle.team[0].crowns > battle.opponent[0].crowns) {
        player1wins += 1;
        battles.push({
          winnerTag: player1data.playerTag,
          loserTag: player2data.playerTag,
          winnerId: player1id,
          loserId: player2id,
          battleTime: new Date(
            battle.battleTime.slice(0, 4) +
              "-" +
              battle.battleTime.slice(4, 6) +
              "-" +
              battle.battleTime.slice(6, 8) +
              "T" +
              battle.battleTime.slice(9, 11) +
              ":" +
              battle.battleTime.slice(11, 13) +
              ":" +
              battle.battleTime.slice(13)
          ),
          player1cards: battle.team[0].cards.map((card: any) => card.name),
          player2cards: battle.opponent[0].cards.map((card: any) => card.name),
        });
      } else if (battle.team[0].crowns < battle.opponent[0].crowns) {
        player2wins += 1;
        battles.push({
          winnerTag: player2data.playerTag,
          loserTag: player1data.playerTag,
          winnerId: player2id,
          loserId: player1id,
          battleTime: new Date(
            battle.battleTime.slice(0, 4) +
              "-" +
              battle.battleTime.slice(4, 6) +
              "-" +
              battle.battleTime.slice(6, 8) +
              "T" +
              battle.battleTime.slice(9, 11) +
              ":" +
              battle.battleTime.slice(11, 13) +
              ":" +
              battle.battleTime.slice(13)
          ),
          player1cards: battle.opponent[0].cards.map((card: any) => card.name),
          player2cards: battle.team[0].cards.map((card: any) => card.name),
        });
      }

      battlesProcessed++;

      // Break after processing the required number of battles
      if (battlesProcessed >= maxBattlesToCheck) {
        break;
      }
    }

    if (player1wins > player2wins) {
      const elochange = calculateEloChange(player1data.elo, player2data.elo);
      await interaction.reply({
        content: `🏆 <@${player1id}> wins the match! (+${elochange.winnerChange} ELO) <@${player2id}> (-${elochange.loserChange} ELO)`,
      });

      // output to battle log channel
      const blogchan = (await interaction.guild!.channels.fetch(
        battleLogChannel
      )) as TextChannel;

      let embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(
          `Match Result: ${
            (await interaction.guild!.members.fetch(player1id)).displayName
          } (${player1data.elo}) vs ${
            (await interaction.guild!.members.fetch(player2id)).displayName
          } (${player2data.elo})`
        )
        .setDescription(
          `<@${player1id}> defeats <@${player2id}> ${player1wins}-${player2wins}!\n\nELO Change: +${elochange.winnerChange} for <@${player1id}>, -${elochange.loserChange} for <@${player2id}>`
        )
        .addFields([] as { name: string; value: string; inline: boolean }[])
        .setTimestamp(new Date());

      await blogchan.send({
        content: `<@${player1id}> <@${player2id}>`,
        embeds: [embed],
      });
      // update elo and wins/losses
      await persistBattleLog(battles, elochange, player1id, player2id);
    } else if (player2wins > player1wins) {
      const elochange = calculateEloChange(player2data.elo, player1data.elo);
      await interaction.reply({
        content: `🏆 <@${player2id}> wins the match! (+${elochange.winnerChange} ELO) <@${player1id}> (-${elochange.loserChange} ELO)`,
      });

      // output to battle log channel
      const blogchan = (await interaction.guild!.channels.fetch(
        battleLogChannel
      )) as TextChannel;

      let embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(
          `Match Result: ${
            (await interaction.guild!.members.fetch(player1id)).displayName
          } (${player1data.elo}) vs ${
            (await interaction.guild!.members.fetch(player2id)).displayName
          } (${player2data.elo})`
        )
        .setDescription(
          `\n🏆<@${player2id}> defeats <@${player1id}> ${player2wins}-${player1wins}!\n\n📊ELO Change: +${elochange.winnerChange} for <@${player2id}>, -${elochange.loserChange} for <@${player1id}>`
        )
        .addFields([] as { name: string; value: string; inline: boolean }[])
        .setTimestamp(new Date());

      await blogchan.send({
        content: `<@${player1id}> <@${player2id}>`,
        embeds: [embed],
      });
      // update elo and wins/losses
      await persistBattleLog(battles, elochange, player2id, player1id);
    }

    // Delete match channel
    if (
      interaction.channel &&
      interaction.channel.type === ChannelType.GuildText
    ) {
      await interaction.channel.delete();
    }
  },
};
