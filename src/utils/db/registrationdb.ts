import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { cards } from "../data/cards";

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
  const existingUser = await fetchRegistration(discordId);
  if (existingUser !== null) {
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
    Select: "COUNT" as const,
  };

  try {
    const existingByTagResult = await ddbDocClient.send(
      new QueryCommand(existingByTagCommand)
    );
    if (existingByTagResult.Count && existingByTagResult.Count > 0) {
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

async function fetchRegistration(discordId: string) {
  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Key: {
      id: discordId,
    },
  };

  try {
    const result = await ddbDocClient.send(new GetCommand(command));
    if (result.Item) {
      return {
        deckList: JSON.parse(result.Item.deckList),
        playerTag: result.Item.playerTag,
      }; // Return parsed deck list
    } else {
      return null; // No registration found
    }
  } catch (error) {
    console.error("Error fetching from DynamoDB:", error);
    return null;
  }
}

async function getUserData(discordId: string) {
  const command = {
    TableName: REGISTRATION_TABLE_NAME,
    Key: {
      id: discordId,
    },
  };

  try {
    const result = await ddbDocClient.send(new GetCommand(command));
    if (result.Item) {
      return result.Item; // Return full user data
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

async function updateUserData(
  discordId: string,
  updates: { [key: string]: any }
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

export { initiateRegistration, fetchRegistration, getUserData, playerJoinGame };
