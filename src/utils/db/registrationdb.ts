import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { getVerifiedPlayers, setVerifiedPlayers } from "../cache/queuecache";
import { cards } from "../data/cards";
import { PlayerData } from "../classes_types/PlayerData";
import { BattleLog } from "../classes_types/BattleLog";
import { Player } from "glicko2.ts";

const REGION = process.env.AWS_REGION || "us-east-1";
const REGISTRATION_TABLE_NAME = "ranked_crl_registration_table";

// Base client
const ddbClient = new DynamoDBClient({ region: REGION });

// Minimal safe config
const marshallOptions = {
  removeUndefinedValues: true, // prevents errors if your objects have undefined fields
};

const translateConfig = { marshallOptions };

// DocumentClient wrapper (lets you work with plain JS objects)
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

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
      elo: 1000, // Initial ELO
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
      placement_games: 5,
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

async function getUserData(discordId: string): Promise<PlayerData | null> {
  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Key: {
      id: discordId,
    },
  };

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

async function playerJoinGame(discordId: string, opponentId: string) {
  // Update user data to reflect that they are now in a game
  await updateUserData(discordId, {
    in_game: true,
    current_opponent: opponentId,
    game_start_time: Date.now(),
  });
}

async function setFriendLink(discordId: string, friendLink: string) {
  const res = await updateUserData(discordId, {
    friend_link: friendLink,
  });

  return res;
}

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

  const updateExpressions = [];
  const expressionAttributeNames: { [key: string]: string } = {};
  const expressionAttributeValues: { [key: string]: any } = {};

  for (const key in cleanUpdates) {
    updateExpressions.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key; // Handle reserved keywords
    expressionAttributeValues[`:${key}`] = cleanUpdates[key];
  }

  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Key: {
      id: discordId,
    },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  try {
    await ddbDocClient.send(new UpdateCommand(command));
    return true;
  } catch (error) {
    console.error("Error updating user data in DynamoDB:", error);
    return false;
  }
}

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

  let winnerpg = false;
  if (winnerold.placement_games > 0) {
    winnerpg = true;
  }
  const updatewinnerres = await updateUserData(winnerId, {
    current_opponent: "",
    elo: Math.round(Math.max(0, winnerplayer.getRating())),
    placement_games: winnerpg ? winnerold.placement_games - 1 : 0,
    glicko_rd: winnerpg ? 350 : winnerplayer.getRd(),
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

  let loserpg = false;
  if (loserold.placement_games > 0) {
    loserpg = true;
  }
  const updateloserres = await updateUserData(loserId, {
    current_opponent: undefined,
    elo: Math.round(Math.max(0, loserplayer.getRating())),
    placement_games: loserpg ? loserold.placement_games - 1 : 0,
    glicko_rd: loserpg ? 350 : loserplayer.getRd(),
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

async function terminateGame(discordId: string) {
  // Update user data to reflect that they are no longer in a game
  const res = await updateUserData(discordId, {
    in_game: false,
    current_opponent: "",
  });

  return res;
}

async function finishRegistration(discordId: string) {
  const res = await updateUserData(discordId, {
    verified: true,
  });

  return res;
}

async function getPlayerRank(discordId: string): Promise<string> {
  const cachedData = await getVerifiedPlayers();
  let verifiedPlayers;

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

  if (verifiedPlayers.length === 0) {
    return "0/0";
  }

  const sortedPlayers = verifiedPlayers.sort((a: any, b: any) => b.elo - a.elo);
  const playerIndex = sortedPlayers.findIndex(
    (player: any) => player.id === discordId
  );

  if (playerIndex === -1) {
    return "Unranked";
  }

  return `${playerIndex + 1}/${sortedPlayers.length}`;
}

async function fetchTopPlayers(limit: number): Promise<PlayerData[]> {
  const cachedData = await getVerifiedPlayers();
  let verifiedPlayers;

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

  if (verifiedPlayers.length === 0) {
    return [];
  }

  const sortedPlayers = verifiedPlayers.sort((a: any, b: any) => b.elo - a.elo);
  return sortedPlayers.slice(0, limit);
}

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
    placement_games: 5,
  });

  return res;
}

export {
  initiateRegistration,
  getUserData,
  playerJoinGame,
  persistBattleLog,
  setFriendLink,
  terminateGame,
  finishRegistration,
  getPlayerRank,
  fetchTopPlayers,
  setupGlicko,
};
