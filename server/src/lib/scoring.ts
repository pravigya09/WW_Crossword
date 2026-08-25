export function calculateScore(params: {
  timeTakenSeconds: number;
  hintsUsed: number;
  wrongGuesses: number;
  timeLimitSeconds?: number | null;
}): number {
  const { timeTakenSeconds, hintsUsed, wrongGuesses, timeLimitSeconds } = params;

  let score = 1000;

  // Time deduction: 1pt per 2 seconds, no cap — faster always scores higher
  score -= Math.floor(timeTakenSeconds / 2);

  // Hint penalty: 50 points per hint used
  score -= hintsUsed * 50;

  // Wrong guess penalty: 10 points per wrong guess (capped at 200)
  score -= Math.min(200, wrongGuesses * 10);

  // Bonus for finishing in under half the time limit
  if (timeLimitSeconds && timeTakenSeconds < timeLimitSeconds * 0.5) {
    score += 100;
  }

  return Math.max(0, score);
}
