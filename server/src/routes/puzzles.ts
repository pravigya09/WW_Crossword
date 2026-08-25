import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { calculateScore } from '../lib/scoring.js';
import { v4 as uuidv4 } from 'uuid';

export const puzzleRouter = Router();

// GET /api/puzzles/active — get the current playable puzzle (no answer data)
puzzleRouter.get('/active', (_req: Request, res: Response) => {
  const now = new Date().toISOString();
  const puzzle = db.prepare(`
    SELECT * FROM puzzles
    WHERE published=1
      AND (start_at IS NULL OR start_at <= ?)
      AND (end_at IS NULL OR end_at >= ?)
    ORDER BY created_at DESC LIMIT 1
  `).get(now, now) as any;

  if (!puzzle) return res.status(404).json({ error: 'No active puzzle' });

  const grid = JSON.parse(puzzle.grid_json);
  // Strip answers from grid cells before sending to client
  const sanitizedGrid = {
    ...grid,
    cells: grid.cells.map((row: any[]) =>
      row.map((cell: any) => cell ? { wordIds: cell.wordIds } : null)
    ),
    placedWords: grid.placedWords.map((w: any) => ({
      clue: w.clue,
      hint: w.hint,
      row: w.row,
      col: w.col,
      direction: w.direction,
      number: w.number,
      length: w.word.length,
    })),
  };

  res.json({
    id: puzzle.id,
    title: puzzle.title,
    timeLimitSeconds: puzzle.time_limit_seconds,
    hintMode: puzzle.hint_mode,
    startAt: puzzle.start_at,
    endAt: puzzle.end_at,
    grid: sanitizedGrid,
  });
});

// GET /api/puzzles/:id — same but by id (for admin preview)
puzzleRouter.get('/:id', (_req: Request, res: Response) => {
  const puzzle = db.prepare('SELECT * FROM puzzles WHERE id=?').get(_req.params.id) as any;
  if (!puzzle) return res.status(404).json({ error: 'Not found' });

  const grid = JSON.parse(puzzle.grid_json);
  const sanitizedGrid = {
    ...grid,
    cells: grid.cells.map((row: any[]) =>
      row.map((cell: any) => cell ? { wordIds: cell.wordIds } : null)
    ),
    placedWords: grid.placedWords.map((w: any) => ({
      clue: w.clue,
      hint: w.hint,
      row: w.row,
      col: w.col,
      direction: w.direction,
      number: w.number,
      length: w.word.length,
    })),
  };

  res.json({
    id: puzzle.id,
    title: puzzle.title,
    timeLimitSeconds: puzzle.time_limit_seconds,
    hintMode: puzzle.hint_mode,
    startAt: puzzle.start_at,
    endAt: puzzle.end_at,
    grid: sanitizedGrid,
  });
});
