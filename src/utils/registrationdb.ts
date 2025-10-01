import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Select } from "@aws-sdk/client-dynamodb";
import { cards } from "./cards";

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

export { initiateRegistration, fetchRegistration };
