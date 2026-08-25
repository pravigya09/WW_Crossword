import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

export const leaderboardRouter = Router();

// GET /api/leaderboard/:puzzleId
leaderboardRouter.get('/:puzzleId', (req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT name, email, score, time_taken_seconds, hints_used, wrong_guesses, completed_at
    FROM attempts
    WHERE puzzle_id=? AND completed_at IS NOT NULL
    ORDER BY score DESC, time_taken_seconds ASC
    LIMIT 100
  `).all(req.params.puzzleId) as any[];

  const ranked = entries.map((e, i) => ({
    rank: i + 1,
    name: e.name,
    email: e.email,
    score: e.score,
    timeTakenSeconds: e.time_taken_seconds,
    hintsUsed: e.hints_used,
    wrongGuesses: e.wrong_guesses,
    completedAt: e.completed_at,
  }));

  res.json(ranked);
});
