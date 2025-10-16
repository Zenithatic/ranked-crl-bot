import {
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { Glicko2, Player } from "glicko2.ts";
import { BattleLog } from "../classes_types/BattleLog";
import { PlayerData } from "../classes_types/PlayerData";
import { persistBattleLog, setupGlicko } from "../db/registrationdb";
import { logMatchChannel } from "../s3/matchlog";

const battleLogChannel = "1424129349019242597";

/**
 * Handle the end of the game, process ELO changes, log results, and delete match channel
 * @param winnerdata : - PlayerData of the player who won
 * @param loserdata : - PlayerData of the player who lost
 * @param winnerwins : - number of wins for the winner
 * @param loserwins : - number of wins for the loser
 * @param winnerId : - ID of the winner
 * @param loserId : - ID of the loser
 * @param battles : - array of battle logs
 * @param interaction : - interaction object
 */
async function handleGameEnd(
  winnerdata: PlayerData,
  loserdata: PlayerData,
  winnerwins: number,
  loserwins: number,
  winnerId: string,
  loserId: string,
  battles: BattleLog[],
  interaction: ChatInputCommandInteraction,
  endType: "Finished" | "Forced Win" | "Terminated"
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

  // setup game history (count entire bo3 as one game)
  const matches: [Player, Player, number][] = [];
  if (winnerwins > loserwins) {
    matches.push([winnerplayer, loserplayer, 1]);
  } else if (winnerwins === loserwins) {
    // nothing to do for a draw
  } else {
    matches.push([winnerplayer, loserplayer, 0]);
  }

  // process results
  glicko.updateRatings(matches);

  const winnerChange = Math.round(winnerplayer.getRating() - winnerdata.elo);
  const loserChange = Math.round(loserplayer.getRating() - loserdata.elo);

  await interaction.reply({
    content: `🏆 <@${winnerId}> wins the match! (${
      winnerChange > 0 ? "+" + winnerChange : winnerChange
    } ELO) <@${loserId}> (${
      loserChange > 0 ? "+" + loserChange : loserChange
    } ELO)`,
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
      `🏆<@${winnerId}> defeats <@${loserId}> with score **${winnerwins} - ${loserwins}**!\n\n
      Game End Status: ${endType}\n\n 
      📊ELO Change: ${
        winnerChange > 0 ? "+" + winnerChange : winnerChange
      } for <@${winnerId}>, ${
        loserChange > 0 ? "+" + loserChange : loserChange
      } for <@${loserId}>`
    )
    .setTimestamp(new Date());

  await blogchan.send({
    content: `<@${winnerId}> <@${loserId}>`,
    embeds: [embed],
  });

  await persistBattleLog(battles, winnerplayer, loserplayer, winnerId, loserId);

  // Log match channel details to S3
  await logMatchChannel(interaction.channel as TextChannel);

  // Delete match channel
  if (
    interaction.channel &&
    interaction.channel.type === ChannelType.GuildText
  ) {
    await interaction.channel.delete();
  }
}

export { handleGameEnd };
