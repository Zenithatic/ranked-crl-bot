import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/interactionchecks";
import {
  getUserData,
  persistBattleLog,
  setupGlicko,
} from "../../utils/db/registrationdb";
import { getBattleLogs } from "../../utils/data/api";
import { BattleLog } from "../../utils/classes_types/BattleLog";
import { PlayerData } from "../../utils/classes_types/PlayerData";
import { Glicko2, Player } from "glicko2.ts";

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
    const timestart = parseInt(interaction.channel.topic!.split("-")[1]);

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

    const rawbattles = await player1logs.json();
    let player1battles = [];

    // add top battles against other player, after channel was created
    for (const battle of rawbattles) {
      const raw = battle.battleTime;
      const iso = raw.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}\.\d{3}Z)$/,
        "$1-$2-$3T$4:$5:$6"
      );
      if (
        battle.opponent[0].tag == "#" + player2data.playerTag &&
        new Date(iso).getTime() >= timestart
      ) {
        player1battles.push(battle);
      } else {
        break;
      }
    }

    // no battles found
    if (player1battles.length === 0) {
      interaction.reply({
        content: `❌ <@${player1id}> has not played against <@${player2id}> in their latest matches.`,
      });
      return;
    }

    // reverse to get most oldest first
    player1battles = player1battles.reverse();

    let battles: BattleLog[] = [];
    let player1wins = 0;
    let player2wins = 0;
    const maxBattlesToCheck = 3; // Best of 3
    let validBattlesProcessed = 0;

    // Track used cards for duplicate detection
    const player1UsedCards: string[] = [];
    const player2UsedCards: string[] = [];

    for (const battle of player1battles) {
      // Break after processing the required number of battles
      if (validBattlesProcessed >= maxBattlesToCheck) {
        break;
      }

      if (battle.team[0].crowns > battle.opponent[0].crowns) {
        // Check if winner used duplicate cards
        const player1Cards = battle.team[0].cards.map((card: any) => card.name);
        let player1duped = false;
        for (const card of player1Cards) {
          if (player1UsedCards.includes(card)) {
            // Player 1 uses dupe, win does not count, go to next battle
            player1duped = true;
            break;
          }
        }
        if (player1duped) {
          continue;
        }

        // Winner did not dupe, win counts
        player1wins += 1;
        validBattlesProcessed += player1wins == 2 ? 3 : 1; // end if player1 wins 2

        // Check if loser used duplicate cards
        const player2Cards = battle.opponent[0].cards.map(
          (card: any) => card.name
        );
        let player2duped = false;
        for (const card of player2Cards) {
          if (player2UsedCards.includes(card)) {
            // Player 2 uses dupe but still loses, win counts
            player2duped = true;
            break;
          }
        }
        if (!player2duped) {
          // add cards to used arrays
          player1UsedCards.push(...player1Cards);
          player2UsedCards.push(...player2Cards);
        }

        battles.push({
          winnerTag: player1data.playerTag,
          loserTag: player2data.playerTag,
          winnerId: player1id,
          loserId: player2id,
          battleTime: new Date(battle.battleTime),
          player1cards: player1Cards,
          player2cards: player2Cards,
        });
      } else if (battle.team[0].crowns < battle.opponent[0].crowns) {
        // Check if winner used duplicate cards
        const player2Cards = battle.opponent[0].cards.map(
          (card: any) => card.name
        );
        let player2duped = false;
        for (const card of player2Cards) {
          if (player2UsedCards.includes(card)) {
            // Player 2 uses dupe, win does not count, go to next battle
            player2duped = true;
            break;
          }
        }
        if (player2duped) {
          continue;
        }

        // Winner did not dupe, win counts
        player2wins += 1;
        validBattlesProcessed += player2wins == 2 ? 3 : 1; // end if player2 wins 2

        // Check if loser used duplicate cards
        const player1Cards = battle.team[0].cards.map((card: any) => card.name);
        let player1duped = false;
        for (const card of player1Cards) {
          if (player1UsedCards.includes(card)) {
            // Player 1 uses dupe but still loses, win counts
            player1duped = true;
            break;
          }
        }
        if (!player1duped) {
          // add cards to used arrays
          player1UsedCards.push(...player1Cards);
          player2UsedCards.push(...player2Cards);
        }

        battles.push({
          winnerTag: player2data.playerTag,
          loserTag: player1data.playerTag,
          winnerId: player2id,
          loserId: player1id,
          battleTime: new Date(battle.battleTime),
          player1cards: player1Cards,
          player2cards: player2Cards,
        });
      }
    }

    // Nobody wins yet
    if (player1wins < 2 && player2wins < 2) {
      interaction.reply({
        content: `❌ Nobody between <@${player1id}> and <@${player2id}> has won yet.\n\n
          Current score: <@${player1id}> ${player1wins} - ${player2wins} <@${player2id}>\n
          Battle Log:\n
          ${JSON.stringify(battles, null, 2)}\n
          <@${player1id}>'s used cards:\n
          ${JSON.stringify(player1UsedCards, null, 2)}\n
          <@${player2id}>'s used cards:\n
          ${JSON.stringify(player2UsedCards, null, 2)}\n
          `,
      });
      return;
    }

    if (player1wins > player2wins) {
      await handleGameEnd(
        player1data,
        player2data,
        player1wins,
        player2wins,
        player1id,
        player2id,
        battles,
        interaction
      );
    } else if (player2wins > player1wins) {
      await handleGameEnd(
        player2data,
        player1data,
        player2wins,
        player1wins,
        player2id,
        player1id,
        battles,
        interaction
      );
    }
  },
};

async function handleGameEnd(
  winnerdata: PlayerData,
  loserdata: PlayerData,
  winnerwins: number,
  loserwins: number,
  winnerId: string,
  loserId: string,
  battles: BattleLog[],
  interaction: ChatInputCommandInteraction
) {
  // Setup glicko in db for players if not there
  await setupGlicko(winnerId);
  await setupGlicko(loserId);

  // Setup glicko
  const glicko = new Glicko2();
  const winnerplayer = glicko.makePlayer(
    winnerdata.elo,
    winnerdata.glicko_rd,
    winnerdata.glicko_vol
  );
  const loserplayer = glicko.makePlayer(
    loserdata.elo,
    loserdata.glicko_rd,
    loserdata.glicko_vol
  );

  // setup game history
  const matches: [Player, Player, number][] = [];
  for (let i = 0; i < winnerwins; i++) {
    matches.push([winnerplayer, loserplayer, 1]); // Winner beat loser
  }
  for (let i = 0; i < loserwins; i++) {
    matches.push([winnerplayer, loserplayer, 0]); // Winner lost to loser
  }

  // process results
  glicko.updateRatings(matches);

  await interaction.reply({
    content: `🏆 <@${winnerId}> wins the match! (+${
      winnerplayer.getRating() - winnerdata.elo
    } ELO) <@${loserId}> (${loserplayer.getRating() - loserdata.elo} ELO)`,
  });

  const blogchan = (await interaction.guild!.channels.fetch(
    battleLogChannel
  )) as TextChannel;

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(
      `Match Result: ${
        (await interaction.guild!.members.fetch(winnerId)).displayName
      } (${winnerdata.elo}) vs ${
        (await interaction.guild!.members.fetch(loserId)).displayName
      } (${loserdata.elo})`
    )
    .setDescription(
      `🏆<@${winnerId}> defeats <@${loserId}> with score **${winnerwins} - ${loserwins}**!\n\n📊ELO Change: +${
        winnerplayer.getRating() - winnerdata.elo
      } for <@${winnerId}>, ${
        loserplayer.getRating() - loserdata.elo
      } for <@${loserId}>`
    )
    .setTimestamp(new Date());

  await blogchan.send({
    content: `<@${winnerId}> <@${loserId}>`,
    embeds: [embed],
  });

  await persistBattleLog(battles, winnerplayer, loserplayer, winnerId, loserId);

  // Delete match channel
  if (
    interaction.channel &&
    interaction.channel.type === ChannelType.GuildText
  ) {
    await interaction.channel.delete();
  }
}
