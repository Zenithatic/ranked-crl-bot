// Imports
import dotenv from "dotenv";
dotenv.config();
const token = process.env.API_TOKEN;

/**
 * Fetch battle logs for a player from Clash Royale API
 * @param playerTag : - string Clash Royale player tag (without #)
 * @returns Promise resolving to the fetch response
 */
async function getBattleLogs(playerTag: string) {
  const response = await fetch(
    "https://api.clashroyale.com/v1/players/%23" + playerTag + "/battlelog",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  return response;
}

/** Fetch player details from Clash Royale API
 * @param playerTag : - string Clash Royale player tag (without #)
 * @returns Promise resolving to the fetch response
 */
async function getPlayer(playerTag: string) {
  const response = await fetch(
    "https://api.clashroyale.com/v1/players/%23" + playerTag,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  return response;
}

// Exports
export { getBattleLogs, getPlayer };
