import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import dotenv from "dotenv";
import {
  CooldownManager,
  COOLDOWN_TIMES,
} from "../../utils/classes_types/cooldown";
import { commandCheck } from "../../utils/functions/interactionchecks";
import {
  getUserData,
  persistBattleLog,
  setupGlicko,
  updateUserData,
} from "../../utils/db/registrationdb";
import { Glicko2, Player } from "glicko2.ts";
import { BattleLog } from "../../utils/classes_types/BattleLog";
dotenv.config();

const battleLogChannel = "1424129349019242597";

// Create a cooldown manager for this command with 30-second cooldown
const cooldown = new CooldownManager(COOLDOWN_TIMES.THIRTY_SECONDS);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forcewin")
    .setDescription("Force a win for the specified player.")
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The player to force a win for.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), // Allow only people who can ban members to use this command
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
        content: "❌ This command can only be used in a match channel.",
        ephemeral: true,
      });
      return;
    }

    // Get player data
    const player1id = interaction.channel.name.split("-")[1];
    const player2id = interaction.channel.name.split("-")[2];

    // Check if specified player is in the match
    const specifiedPlayer = interaction.options.getUser("player");
    if (
      !specifiedPlayer ||
      (specifiedPlayer.id !== player1id && specifiedPlayer.id !== player2id)
    ) {
      await interaction.reply({
        content: "❌ The specified player is not in this match.",
        ephemeral: true,
      });
      return;
    }

    const winnerId = specifiedPlayer.id;
    const loserId = winnerId === player1id ? player2id : player1id;
    const winnerdata = await getUserData(winnerId);
    const loserdata = await getUserData(loserId);

    if (!winnerdata || !loserdata) {
      await interaction.reply({
        content: "❌ Error retrieving player data. Please contact a developer.",
        ephemeral: true,
      });
      return;
    }

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
    matches.push([winnerplayer, loserplayer, 1]);

    // process results
    glicko.updateRatings(matches);

    await interaction.reply({
      content: `🏆 <@${winnerId}> wins the match! (+${Math.round(
        winnerplayer.getRating() - winnerdata.elo
      )} ELO) <@${loserId}> (${Math.round(
        loserplayer.getRating() - loserdata.elo
      )} ELO)`,
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
        `🏆<@${winnerId}> defeats <@${loserId}> with score **${1} - ${0}** (force win)!\n\n📊ELO Change: +${Math.round(
          winnerplayer.getRating() - winnerdata.elo
        )} for <@${winnerId}>, ${Math.round(
          loserplayer.getRating() - loserdata.elo
        )} for <@${loserId}>`
      )
      .setTimestamp(new Date());

    await blogchan.send({
      content: `<@${winnerId}> <@${loserId}>`,
      embeds: [embed],
    });

    const battles: BattleLog[] = [];

    await persistBattleLog(
      battles,
      winnerplayer,
      loserplayer,
      winnerId,
      loserId
    );

    // Delete match channel
    if (
      interaction.channel &&
      interaction.channel.type === ChannelType.GuildText
    ) {
      await interaction.channel.delete();
    }
  },
};
