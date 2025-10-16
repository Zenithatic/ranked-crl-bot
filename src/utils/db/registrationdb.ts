// Imports
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Player } from "glicko2.ts";
import { getVerifiedPlayers, setVerifiedPlayers } from "../cache/queuecache";
import { BattleLog } from "../classes_types/BattleLog";
import { PlayerData } from "../classes_types/PlayerData";
import { cards } from "../data/cards";

// Constants and DB client
const REGION = process.env.AWS_REGION || "us-east-1";
const REGISTRATION_TABLE_NAME = "ranked_crl_registration_table";
const ddbClient = new DynamoDBClient({ region: REGION });
const marshallOptions = {
  removeUndefinedValues: true, // prevents errors if your objects have undefined fields
};
const translateConfig = { marshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

/**
 * Initiate registration for a user by player tag and discord ID
 * @param playerTag : - string Player tag without leading #
 * @param discordId : - string Discord ID of the user
 * @returns null if registration fails or array of card IDs if successful
 */
async function initiateRegistration(playerTag: string, discordId: string) {
  // Check if discordId is already registered (fast check using primary key)
  const existingUser = await getUserData(discordId);
  if (existingUser !== null && existingUser.verified === true) {
    console.warn(
      `Discord ID ${discordId} is already registered. Registration aborted.`
    );
    return null;
  }

  // Check if playerTag is already registered (efficient query using GSI)
  const existingByTagCommand = {
    TableName: REGISTRATION_TABLE_NAME,
    IndexName: "playerTag-index",
    KeyConditionExpression: "playerTag = :pt",
    ExpressionAttributeValues: {
      ":pt": playerTag,
    },
    Limit: 10,
  };

  try {
    const existingByTagResult = await ddbDocClient.send(
      new QueryCommand(existingByTagCommand)
    );
    if (
      existingByTagResult.Items &&
      existingByTagResult.Items.length > 0 &&
      existingByTagResult.Items.some((item) => item.verified === true)
    ) {
      console.warn(
        `Player tag ${playerTag} is already registered. Registration aborted.`
      );
      return null;
    }
  } catch (error) {
    console.error("Error checking existing player tag in DynamoDB:", error);
    return null;
  }

  // Generate a deck with cards
  let cardsCopy = [...cards];

  // Shuffle and select 8 random cards
  cardsCopy = cardsCopy.sort(() => Math.random() - 0.5).slice(0, 8);
  let deckList = cardsCopy.map((card) => card.id);

  // Save to DynamoDB
  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Item: {
      id: discordId,
      playerTag: playerTag,
      deckList: JSON.stringify(deckList),
      timestamp: Date.now(),
      elo: 1500, // Initial ELO
      wins: 0,
      losses: 0,
      user_created: Date.now(),
      win_streak: 0,
      past_finishes: JSON.stringify([]),
      past_20_games: JSON.stringify([]),
      in_game: false,
      current_opponent: null,
      game_start_time: null,
      verified: false,
      friend_link: "",
      glicko_rd: 350,
      glicko_vol: 0.06,
    },
  };

  // Execute the command and catch any errors
  try {
    await ddbDocClient.send(new PutCommand(command));
  } catch (error) {
    console.error("Error saving to DynamoDB:", error);
    return null;
  }

  // Return the deck list
  return deckList;
}

/**
 * Fetch user data by Discord ID
 * @param discordId : - string Discord ID of the user
 * @returns null if user data not found or PlayerData object if found
 */
async function getUserData(discordId: string): Promise<PlayerData | null> {
  // Setup command
  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Key: {
      id: discordId,
    },
  };

  // Execute command and return results
  try {
    const result = await ddbDocClient.send(new GetCommand(command));
    if (result.Item) {
      return result.Item as PlayerData; // Return full user data
    } else {
      return null; // No user found
    }
  } catch (error) {
    console.error("Error fetching user data from DynamoDB:", error);
    return null;
  }
}

/**
 * Initiate a game join request for a player
 * @param discordId : - string Discord ID of the user
 * @param opponentId : - string Discord ID of the opponent
 */
async function playerJoinGame(discordId: string, opponentId: string) {
  // Update user data to reflect that they are now in a game
  await updateUserData(discordId, {
    in_game: true,
    current_opponent: opponentId,
    game_start_time: Date.now(),
  });
}

/**
 * Update user data with provided fields
 * @param discordId : - string Discord ID of the user
 * @param updates : - Partial<PlayerData> Object containing fields to update
 * @returns boolean indicating success or failure of the update operation
 */
async function updateUserData(
  discordId: string,
  updates: Partial<PlayerData>
): Promise<boolean> {
  // Filter out undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  );

  if (Object.keys(cleanUpdates).length === 0) {
    console.warn("No valid updates provided");
    return false;
  }

  // Build update expressions
  const updateExpressions = [];
  const expressionAttributeNames: { [key: string]: string } = {};
  const expressionAttributeValues: { [key: string]: any } = {};

  for (const key in cleanUpdates) {
    updateExpressions.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key; // Handle reserved keywords
    expressionAttributeValues[`:${key}`] = cleanUpdates[key];
  }

  // Setup command
  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Key: {
      id: discordId,
    },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  // Execute command and return success status
  try {
    await ddbDocClient.send(new UpdateCommand(command));
    return true;
  } catch (error) {
    console.error("Error updating user data in DynamoDB:", error);
    return false;
  }
}

/** Persist battle log and update player stats after a game
 * @param battleLog : - BattleLog[] Array of battle log entries
 * @param winnerplayer : - Player Glicko2 Player object for the winner
 * @param loserplayer : - Player Glicko2 Player object for the loser
 * @param winnerId : - string Discord ID of the winner
 * @param loserId : - string Discord ID of the loser
 * @returns boolean indicating success or failure of the persistence operation
 */
async function persistBattleLog(
  battleLog: BattleLog[],
  winnerplayer: Player,
  loserplayer: Player,
  winnerId: string,
  loserId: string
) {
  // Get old data
  const winnerold: PlayerData | null = await getUserData(winnerId);
  const loserold: PlayerData | null = await getUserData(loserId);
  if (!winnerold || !loserold) {
    console.error("Error retrieving old user data for battle log persistence");
    return false;
  }

  // Update past 20 game history for players, adding battleLog to both
  let winnerpast20 = JSON.parse(winnerold.past_20_games);
  let loserpast20 = JSON.parse(loserold.past_20_games);
  winnerpast20.unshift(battleLog);
  if (winnerpast20.length > 20) {
    winnerpast20 = winnerpast20.slice(0, 20);
  }
  loserpast20.unshift(battleLog);
  if (loserpast20.length > 20) {
    loserpast20 = loserpast20.slice(0, 20);
  }

  // Update winner data
  const updatewinnerres = await updateUserData(winnerId, {
    current_opponent: "",
    elo: Math.round(Math.max(0, winnerplayer.getRating())),
    glicko_rd: winnerplayer.getRd(),
    glicko_vol: winnerplayer.getVol(),
    in_game: false,
    past_20_games: JSON.stringify(winnerpast20),
    wins: winnerold.wins + 1,
    win_streak: winnerold.win_streak + 1,
  });

  if (!updatewinnerres) {
    console.error("Error updating winner data after game");
    return false;
  }

  // Update loser data
  const updateloserres = await updateUserData(loserId, {
    current_opponent: undefined,
    elo: Math.round(Math.max(0, loserplayer.getRating())),
    glicko_rd: loserplayer.getRd(),
    glicko_vol: loserplayer.getVol(),
    in_game: false,
    past_20_games: JSON.stringify(loserpast20),
    losses: loserold.losses + 1,
    win_streak: 0,
  });

  if (!updateloserres) {
    console.error("Error updating loser data after game");
    return false;
  }

  return true;
}

/**
 * Get player rank among verified players
 * @param discordId : - string Discord ID of the user
 * @returns string representing the player's rank (e.g., "5/100") or "Unranked" if not found
 */
async function getPlayerRank(discordId: string): Promise<string> {
  // Search cache first
  const cachedData = await getVerifiedPlayers();
  let verifiedPlayers;

  // If not in cache, fetch from DB and update cache
  if (cachedData !== "") {
    verifiedPlayers = JSON.parse(cachedData);
  } else {
    const command = {
      TableName: REGISTRATION_TABLE_NAME,
      FilterExpression: "verified = :verified",
      ExpressionAttributeValues: {
        ":verified": true,
      },
    };

    const result = await ddbDocClient.send(new ScanCommand(command));
    verifiedPlayers = result.Items || [];
    await setVerifiedPlayers(JSON.stringify(verifiedPlayers));
  }

  // If no verified players, return 0/0
  if (verifiedPlayers.length === 0) {
    return "0/0";
  }

  // Sort players by ELO descending and find the index of the specified player
  const sortedPlayers = verifiedPlayers.sort((a: any, b: any) => b.elo - a.elo);
  const playerIndex = sortedPlayers.findIndex(
    (player: any) => player.id === discordId
  );

  if (playerIndex === -1) {
    return "Unranked";
  }

  return `${playerIndex + 1}/${sortedPlayers.length}`;
}

/** Fetch top N players by ELO
 * @param limit : - number Number of top players to fetch
 * @returns Array of PlayerData objects for the top players
 */
async function fetchTopPlayers(limit: number): Promise<PlayerData[]> {
  // Search cache first
  const cachedData = await getVerifiedPlayers();
  let verifiedPlayers;

  // If not in cache, fetch from DB and update cache
  if (cachedData !== "") {
    verifiedPlayers = JSON.parse(cachedData);
  } else {
    const command = {
      TableName: REGISTRATION_TABLE_NAME,
      FilterExpression: "verified = :verified",
      ExpressionAttributeValues: {
        ":verified": true,
      },
    };

    const result = await ddbDocClient.send(new ScanCommand(command));
    verifiedPlayers = result.Items || [];
    if (verifiedPlayers.length !== 0) {
      await setVerifiedPlayers(JSON.stringify(verifiedPlayers));
    }
  }

  // If no verified players, return empty array
  if (verifiedPlayers.length === 0) {
    return [];
  }

  // Sort players by ELO descending and return top N
  const sortedPlayers = verifiedPlayers.sort((a: any, b: any) => b.elo - a.elo);
  return sortedPlayers.slice(0, limit);
}

/** Setup Glicko parameters for a user if not already set
 * @param discordId : - string Discord ID of the user
 * @returns boolean indicating success or failure of the setup operation
 */
async function setupGlicko(discordId: string) {
  const userData = await getUserData(discordId);

  if (!userData) {
    console.error(`User with ID ${discordId} not found for Glicko setup.`);
    return false;
  }

  if (userData.glicko_rd) {
    return true; // Glicko already set up
  }

  const res = await updateUserData(discordId, {
    glicko_rd: 350,
    glicko_vol: 0.06,
  });

  return res;
}

// Exports
export {
  fetchTopPlayers,
  getPlayerRank,
  getUserData,
  initiateRegistration,
  persistBattleLog,
  playerJoinGame,
  setupGlicko,
  updateUserData,
};
