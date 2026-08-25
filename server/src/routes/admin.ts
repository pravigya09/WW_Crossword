import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { generateCrossword } from '../lib/crossword.js';
import { v4 as uuidv4 } from 'uuid';

export const adminRouter = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  // Support session auth (browser), header auth, or query param auth (scripts)
  if ((req.session as any).adminAuth) return next();
  const expected = process.env.ADMIN_PASSWORD || 'changeme';
  const headerPw = req.headers['x-admin-password'];
  if (headerPw && headerPw === expected) return next();
  const queryPw = req.query['pw'];
  if (queryPw && queryPw === expected) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// POST /api/admin/login
adminRouter.post('/login', (req: Request, res: Response) => {
  const { password } = req.body as { password: string };
  const expected = process.env.ADMIN_PASSWORD || 'changeme';
  if (password === expected) {
    (req.session as any).adminAuth = true;
    res.json({ ok: true, token: expected });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// POST /api/admin/logout
adminRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/admin/me
adminRouter.get('/me', requireAdmin, (_req: Request, res: Response) => {
  res.json({ authenticated: true });
});

// GET /api/admin/clues — list all un-published clue entries (draft pool)
adminRouter.get('/clues', requireAdmin, (_req: Request, res: Response) => {
  const clues = db.prepare('SELECT * FROM clue_sets WHERE puzzle_id IS NULL ORDER BY created_at ASC').all();
  res.json(clues);
});

// POST /api/admin/clues
adminRouter.post('/clues', requireAdmin, (req: Request, res: Response) => {
  const { clue, answer, hint } = req.body as { clue: string; answer: string; hint?: string };
  const cleaned = answer.toUpperCase().replace(/[^A-Z]/g, '');
  if (!cleaned) return res.status(400).json({ error: 'Answer must contain letters only' });
  if (!clue.trim()) return res.status(400).json({ error: 'Clue text required' });

  const id = uuidv4();
  db.prepare('INSERT INTO clue_sets (id, clue, answer, hint) VALUES (?, ?, ?, ?)').run(id, clue.trim(), cleaned, hint?.trim() || null);
  res.json({ id, clue: clue.trim(), answer: cleaned, hint: hint?.trim() || null });
});

// PUT /api/admin/clues/:id
adminRouter.put('/clues/:id', requireAdmin, (req: Request, res: Response) => {
  const { clue, answer, hint } = req.body as { clue: string; answer: string; hint?: string };
  const cleaned = answer.toUpperCase().replace(/[^A-Z]/g, '');
  if (!cleaned) return res.status(400).json({ error: 'Answer must contain letters only' });
  db.prepare('UPDATE clue_sets SET clue=?, answer=?, hint=? WHERE id=? AND puzzle_id IS NULL')
    .run(clue.trim(), cleaned, hint?.trim() || null, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/admin/clues/:id
adminRouter.delete('/clues/:id', requireAdmin, (req: Request, res: Response) => {
  db.prepare('DELETE FROM clue_sets WHERE id=? AND puzzle_id IS NULL').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/admin/generate — generate a crossword from current draft clues
adminRouter.post('/generate', requireAdmin, (_req: Request, res: Response) => {
  const clues = db.prepare('SELECT * FROM clue_sets WHERE puzzle_id IS NULL').all() as {
    id: string; clue: string; answer: string; hint?: string;
  }[];

  if (clues.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 clues to generate a crossword' });
  }

  const grid = generateCrossword(clues.map(c => ({ word: c.answer, clue: c.clue, hint: c.hint })));
  res.json(grid);
});

// POST /api/admin/puzzles — save and publish a puzzle
adminRouter.post('/puzzles', requireAdmin, (req: Request, res: Response) => {
  const { title, grid, startAt, endAt, timeLimitSeconds, hintMode } = req.body as {
    title: string;
    grid: object;
    startAt?: string;
    endAt?: string;
    timeLimitSeconds?: number;
    hintMode?: string;
  };

  const clues = db.prepare('SELECT * FROM clue_sets WHERE puzzle_id IS NULL').all() as {
    id: string; clue: string; answer: string; hint?: string;
  }[];

  const id = uuidv4();
  db.prepare(`
    INSERT INTO puzzles (id, title, grid_json, clues_json, start_at, end_at, time_limit_seconds, hint_mode, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, title, JSON.stringify(grid), JSON.stringify(clues), startAt || null, endAt || null, timeLimitSeconds || null, hintMode || 'text');

  // Link clues to this puzzle
  const updateClue = db.prepare('UPDATE clue_sets SET puzzle_id=? WHERE id=?');
  db.transaction(() => clues.forEach(c => updateClue.run(id, c.id)));

  res.json({ id });
});

// GET /api/admin/puzzles — list all puzzles
adminRouter.get('/puzzles', requireAdmin, (_req: Request, res: Response) => {
  const puzzles = db.prepare('SELECT * FROM puzzles ORDER BY created_at DESC').all();
  res.json(puzzles);
});

// GET /api/admin/puzzles/:id/stats — stats for a published puzzle
adminRouter.get('/puzzles/:id/stats', requireAdmin, (req: Request, res: Response) => {
  const testEmail = (process.env.TEST_EMAIL || 'test@ww.internal').toLowerCase();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_attempts,
      COUNT(completed_at) as completions,
      AVG(CASE WHEN completed_at IS NOT NULL THEN time_taken_seconds END) as avg_time,
      AVG(CASE WHEN completed_at IS NOT NULL THEN score END) as avg_score
    FROM attempts WHERE puzzle_id=? AND email != ?
  `).get(req.params.id, testEmail);
  res.json(stats);
});

// DELETE /api/admin/puzzles/:id — delete a puzzle
adminRouter.delete('/puzzles/:id', requireAdmin, (req: Request, res: Response) => {
  db.prepare('DELETE FROM puzzles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/admin/puzzles/:id — update puzzle settings
adminRouter.put('/puzzles/:id', requireAdmin, (req: Request, res: Response) => {
  const { title, startAt, endAt, timeLimitSeconds, hintMode } = req.body as {
    title?: string;
    startAt?: string;
    endAt?: string;
    timeLimitSeconds?: number;
    hintMode?: string;
  };
  db.prepare(`
    UPDATE puzzles SET title=COALESCE(?,title), start_at=?, end_at=?, time_limit_seconds=?, hint_mode=COALESCE(?,hint_mode)
    WHERE id=?
  `).run(title || null, startAt || null, endAt || null, timeLimitSeconds || null, hintMode || null, req.params.id);
  res.json({ ok: true });
});
