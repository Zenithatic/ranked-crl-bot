// Imports
import Redis from "ioredis";
import { getUserData, playerJoinGame } from "../db/registrationdb";
const P = "ranked-crl-valkey-rg.miaymu.ng.0001.use1.cache.amazonaws.com:6379";
let redis: Redis | undefined = undefined;

/**
 * Initialize Redis client if not already initialized
 */
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

/**
 * Adds a player to the queue
 * @param discordId - The Discord ID of the player
 * @returns A promise that resolves to a message indicating the result
 */
async function queuePlayer(discordId: string) {
  initRedis();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }
  // Fetch user data from DynamoDB
  const userData = await getUserData(discordId);
  if (!userData || !userData.elo) {
    return {
      success: false,
      message: ReturnMessage.NO_REGISTRATION,
    };
  }

  // Check if user is already in queue in sorted set
  const isInQueue = await redis.zscore(
    "playerQueueStandard",
    JSON.stringify({ discordId, playerTag: userData.playerTag }) as any
  );
  if (isInQueue) {
    return { success: false, message: ReturnMessage.ALREADY_IN_QUEUE };
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
  const MAX_ELO_DIFF = Math.max((userData.glicko_rd || 350) * 1.5, 200); // calculate based on RD
  const minElo = userElo - MAX_ELO_DIFF;
  const maxElo = userElo + MAX_ELO_DIFF;

  // Get all players in the ELO range with their scores
  const potentialMatches = await redis.zrangebyscore(
    "playerQueueStandard",
    minElo,
    maxElo,
    "WITHSCORES"
  );

  // If found, return closest one
  if (potentialMatches.length > 0) {
    let closestMatch = null;
    let smallestDiff = Infinity;

    // potentialMatches is [member1, score1, member2, score2, ...]
    for (let i = 0; i < potentialMatches.length; i += 2) {
      const memberData = JSON.parse(potentialMatches[i]);
      const memberElo = parseInt(potentialMatches[i + 1]);
      const eloDiff = Math.abs(userElo - memberElo);

      if (eloDiff < smallestDiff) {
        smallestDiff = eloDiff;
        closestMatch = memberData;
      }
    }

    // Add null check
    if (!closestMatch) {
      throw new Error("No valid match found despite having potential matches");
    }

    // Remove matched player from queue
    await redis.zrem("playerQueueStandard", JSON.stringify(closestMatch));

    // Update user data to reflect that they are now in a game
    await playerJoinGame(discordId, closestMatch.discordId);

    // Update other user data as well
    await playerJoinGame(closestMatch.discordId, discordId);

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

/**
 * Fetches the list of verified players from Redis
 * @returns A promise that resolves to the list of verified players
 */
async function getVerifiedPlayers() {
  initRedis();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }
  const result = await redis.get("ranked-crl-verified-players");
  if (!result) {
    return "";
  }
  return result;
}

/**
 * Sets the list of verified players in Redis with a TTL
 * @param data - The data to store
 */
async function setVerifiedPlayers(data: string) {
  initRedis();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }
  const ttl = 60 * 10; // 10 minutes
  await redis.set("ranked-crl-verified-players", data, "EX", ttl);
}

/**
 * Removes a player from the queue
 * @param discordId - The Discord ID of the player
 * @returns A promise that resolves to a message indicating the result
 */
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

// Exports
export {
  ReturnMessage,
  queuePlayer,
  unqueuePlayer,
  getVerifiedPlayers,
  setVerifiedPlayers,
};
