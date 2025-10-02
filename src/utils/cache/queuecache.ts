// Redis cache functions for player queue
import Redis from "ioredis";
import dotenv from "dotenv";
import { getUserData, playerJoinGame } from "../db/registrationdb";
dotenv.config();

const P = "ranked-crl-valkey-rg.miaymu.ng.0001.use1.cache.amazonaws.com:6379";
const MAX_ELO_DIFF = 200;
let redis: Redis | undefined = undefined;

function initRedis() {
  if (!redis) {
    redis = new Redis(P);
  }
}

enum ReturnMessage {
  ALREADY_IN_QUEUE = "You are already in the queue.",
  NO_REGISTRATION = "No registration found. Please register first.",
  ADDED_TO_QUEUE = "You have been added to the queue.",
  MATCH_FOUND = "Match found! Preparing your game...",
  REMOVED_FROM_QUEUE = "You have been removed from the queue.",
  NOT_IN_QUEUE = "You are not in the queue.",
  ALREADY_IN_GAME = "You are currently in a game. Please finish your game before queuing again.",
}

async function queuePlayer(discordId: string) {
  initRedis();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }
  // Check if user is already in queue in sorted set
  const isInQueue = await redis.zscore("playerQueueStandard", discordId);
  if (isInQueue) {
    return { success: false, message: ReturnMessage.ALREADY_IN_QUEUE };
  }

  // Fetch user data from DynamoDB
  const userData = await getUserData(discordId);
  if (!userData || !userData.elo) {
    return {
      success: false,
      message: ReturnMessage.NO_REGISTRATION,
    };
  }

  // Check if user is already in a game
  if (userData.in_game) {
    return {
      success: false,
      message: ReturnMessage.ALREADY_IN_GAME,
    };
  }

  const userElo = userData.elo;

  // See if existing players in queue within acceptable ELO range
  const minElo = userElo - MAX_ELO_DIFF;
  const maxElo = userElo + MAX_ELO_DIFF;

  // Get all players in the ELO range
  const potentialMatches = await redis.zrangebyscore(
    "playerQueueStandard",
    minElo,
    maxElo
  );

  // If found, return closest one
  if (potentialMatches.length > 0) {
    let closestMatch = null;
    let smallestDiff = Infinity;

    for (const match of potentialMatches) {
      const matchData = JSON.parse(match);
      const matchElo = matchData.elo;
      const eloDiff = Math.abs(userElo - matchElo);

      if (eloDiff < smallestDiff) {
        smallestDiff = eloDiff;
        closestMatch = matchData;
      }
    }

    // Remove matched player from queue
    await redis.zrem("playerQueueStandard", JSON.stringify(closestMatch));

    // Update user data to reflect that they are now in a game
    await playerJoinGame(discordId, closestMatch.discordId);

    return {
      success: true,
      match: closestMatch,
      message: ReturnMessage.MATCH_FOUND,
    };
  } else {
    // Store player in sorted set with their ELO as the score, and {discordId, playerTag} as the value
    await redis.zadd(
      "playerQueueStandard",
      userElo,
      JSON.stringify({ discordId, playerTag: userData.playerTag } as any)
    );
    return { success: true, message: ReturnMessage.ADDED_TO_QUEUE };
  }
}

async function unqueuePlayer(discordId: string) {
  initRedis();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  // Get player tag
  const userData = await getUserData(discordId);
  if (!userData) {
    return {
      success: false,
      message: ReturnMessage.NO_REGISTRATION,
    };
  }

  // Remove player from queue
  const removed = await redis.zrem(
    "playerQueueStandard",
    JSON.stringify({ discordId, playerTag: userData.playerTag } as any)
  );
  if (removed) {
    return { success: true, message: ReturnMessage.REMOVED_FROM_QUEUE };
  } else {
    return { success: false, message: ReturnMessage.NOT_IN_QUEUE };
  }
}

export { ReturnMessage, queuePlayer, unqueuePlayer };
