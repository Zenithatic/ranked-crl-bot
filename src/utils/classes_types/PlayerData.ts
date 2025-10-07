type PlayerData = {
  id: string; // Discord ID
  current_opponent: string; // Discord ID of current opponent
  deckList: string; // JSON stringified array of card IDs
  elo: number; // Player's Elo rating
  game_start_time: number; // Timestamp when the game started
  in_game: boolean; // Whether the player is currently in a game
  losses: number; // Total losses
  past_20_games: string; // JSON stringified array of last 20 game results
  past_finishes: string; // JSON stringified array of past finishes (1st, 2nd, etc.)
  playerTag: string; // Clash Royale player tag
  timestamp: number; // Timestamp of last update
  user_created: number; // Timestamp when the user was created
  wins: number; // Total wins
  win_streak: number; // Current win streak
  verified: boolean; // Whether the user is verified
  friend_link: string; // Clash Royale friend link
};

export { PlayerData };
