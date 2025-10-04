// Add this function before your module.exports
function calculateEloChange(
  winnerElo: number,
  loserElo: number
): { winnerChange: number; loserChange: number } {
  const eloDiff = Math.abs(winnerElo - loserElo);

  // K-factor: base multiplier for ELO changes
  const K_FACTOR = 32;

  // Calculate expected win probability using ELO formula
  const expectedWinProbability =
    1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));

  // Calculate base ELO change
  let baseChange = Math.round(K_FACTOR * (1 - expectedWinProbability));

  // Apply minimum change of 5
  const MIN_CHANGE = 5;
  baseChange = Math.max(baseChange, MIN_CHANGE);

  // Apply bonus for large ELO differences
  let bonusMultiplier = 1;
  if (eloDiff >= 200) {
    bonusMultiplier = 1.5; // 50% bonus for 200+ ELO difference
  } else if (eloDiff >= 100) {
    bonusMultiplier = 1.25; // 25% bonus for 100+ ELO difference
  }

  const finalChange = Math.round(baseChange * bonusMultiplier);

  return {
    winnerChange: finalChange,
    loserChange: -finalChange,
  };
}

export { calculateEloChange };
