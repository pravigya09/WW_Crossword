export function calculateScore(params: {
  timeTakenSeconds: number;
  hintsUsed: number;
  wrongGuesses: number;
  timeLimitSeconds?: number | null;
}): number {
  const { timeTakenSeconds, hintsUsed, wrongGuesses, timeLimitSeconds } = params;

  let score = 1000;

  // Time deduction: up to 300 points over first 10 minutes
  const timeDeduction = Math.min(300, Math.floor(timeTakenSeconds / 2));
  score -= timeDeduction;

  // Hint penalty: 50 points per hint used
  score -= hintsUsed * 50;

  // Wrong guess penalty: 10 points per wrong guess (capped at 200)
  score -= Math.min(200, wrongGuesses * 10);

  // Bonus for finishing before time limit
  if (timeLimitSeconds && timeTakenSeconds < timeLimitSeconds * 0.5) {
    score += 100;
  }

  return Math.max(0, score);
}
