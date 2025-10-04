import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextBasedChannel,
  TextChannel,
} from "discord.js";
import dotenv from "dotenv";
import { queuePlayer } from "../../utils/cache/queuecache";
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

const matchChannelCategory = "1421362444382507049";
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
      !interaction.channel.topic ||
      !interaction.channel.topic.startsWith("match-")
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

    const player1battles = await player1logs.json();
    let battles: BattleLog[] = [];
    let player1wins = 0;
    let player2wins = 0;
    for (const battle of player1battles) {
      if (battle.opponent.tag != player2data.playerTag) {
        interaction.reply({
          content: `❌ One of the recent battles for <@${player1id}> is not against <@${player2id}>.`,
        });
        return;
      }

      if (battle.team.crowns > battle.opponent.crowns) {
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
          player1cards: battle.team.cards.map((card: any) => card.name),
          player2cards: battle.opponent.cards.map((card: any) => card.name),
        });
      } else if (battle.team.crowns < battle.opponent.crowns) {
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
          player1cards: battle.opponent.cards.map((card: any) => card.name),
          player2cards: battle.team.cards.map((card: any) => card.name),
        });
      }

      if (player1wins >= 2 || player2wins >= 2) {
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
          `Match Result: <@${player1id}> (${player1data.elo}) vs <@${player2id}> (${player2data.elo})`
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
          `Match Result: <@${player1id}> (${player1data.elo}) vs <@${player2id}> (${player2data.elo})`
        )
        .setDescription(
          `<@${player2id}> defeats <@${player1id}> ${player2wins}-${player1wins}!\n\nELO Change: +${elochange.winnerChange} for <@${player2id}>, -${elochange.loserChange} for <@${player1id}>`
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

    // Set cooldown after successful execution
    cooldown.setCooldown(userId);
  },
};
