type BattleLog = {
  winnerTag: string; // Clash Royale tag of winner
  loserTag: string; // Clash Royale tag of loser
  winnerId: string; // Discord ID of winner
  loserId: string; // Discord ID of loser
  battleTime: Date; // Date and time of battle
  player1cards: string[]; // Names of cards used by player 1
  player2cards: string[]; // Names of cards used by player 2
};

export { BattleLog };
