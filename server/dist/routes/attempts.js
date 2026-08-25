import { Router } from 'express';
import { db } from '../db/database.js';
import { calculateScore } from '../lib/scoring.js';
import { v4 as uuidv4 } from 'uuid';
export const attemptRouter = Router();
const TEST_EMAIL = (process.env.TEST_EMAIL || 'test@ww.internal').toLowerCase();
// POST /api/attempts — start a new attempt
attemptRouter.post('/', (req, res) => {
    const { puzzleId, name, email } = req.body;
    if (!name?.trim() || !email?.trim()) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    const emailNorm = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    const puzzle = db.prepare('SELECT * FROM puzzles WHERE id=? AND published=1').get(puzzleId);
    if (!puzzle)
        return res.status(404).json({ error: 'Puzzle not found' });
    // Check puzzle window
    const now = new Date();
    if (puzzle.start_at && new Date(puzzle.start_at) > now) {
        return res.status(403).json({ error: 'Puzzle not yet open', code: 'NOT_OPEN' });
    }
    if (puzzle.end_at && new Date(puzzle.end_at) < now) {
        return res.status(403).json({ error: 'Puzzle has closed', code: 'CLOSED' });
    }
    // Test account: wipe previous attempt so it can always replay
    if (emailNorm === TEST_EMAIL) {
        db.prepare('DELETE FROM attempts WHERE puzzle_id=? AND email=?').run(puzzleId, emailNorm);
    }
    else {
        // Regular players: enforce single attempt
        const existing = db.prepare('SELECT * FROM attempts WHERE puzzle_id=? AND email=?').get(puzzleId, emailNorm);
        if (existing) {
            return res.status(409).json({
                error: 'Already attempted',
                code: 'ALREADY_ATTEMPTED',
                attempt: sanitizeAttempt(existing),
            });
        }
    }
    const id = uuidv4();
    db.prepare('INSERT INTO attempts (id, puzzle_id, name, email) VALUES (?, ?, ?, ?)').run(id, puzzleId, name.trim(), emailNorm);
    res.json({ attemptId: id });
});
// GET /api/attempts/:id — get current attempt state
attemptRouter.get('/:id', (req, res) => {
    const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id);
    if (!attempt)
        return res.status(404).json({ error: 'Not found' });
    res.json(sanitizeAttempt(attempt));
});
// POST /api/attempts/:id/check — check a word answer
attemptRouter.post('/:id/check', (req, res) => {
    const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id);
    if (!attempt)
        return res.status(404).json({ error: 'Not found' });
    if (attempt.completed_at)
        return res.status(400).json({ error: 'Attempt already completed' });
    const { wordNumber, direction, answer } = req.body;
    const puzzle = db.prepare('SELECT * FROM puzzles WHERE id=?').get(attempt.puzzle_id);
    const gridData = JSON.parse(puzzle.grid_json);
    const word = gridData.placedWords.find((w) => w.number === wordNumber && w.direction === direction);
    if (!word)
        return res.status(400).json({ error: 'Word not found' });
    const correct = word.word === answer.toUpperCase().replace(/[^A-Z]/g, '');
    if (!correct) {
        db.prepare('UPDATE attempts SET wrong_guesses=wrong_guesses+1 WHERE id=?').run(attempt.id);
    }
    res.json({ correct, word: correct ? word.word : undefined });
});
// POST /api/attempts/:id/hint — request a hint for a word
attemptRouter.post('/:id/hint', (req, res) => {
    const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id);
    if (!attempt)
        return res.status(404).json({ error: 'Not found' });
    if (attempt.completed_at)
        return res.status(400).json({ error: 'Attempt already completed' });
    const { wordNumber, direction } = req.body;
    const puzzle = db.prepare('SELECT * FROM puzzles WHERE id=?').get(attempt.puzzle_id);
    const gridData = JSON.parse(puzzle.grid_json);
    const word = gridData.placedWords.find((w) => w.number === wordNumber && w.direction === direction);
    if (!word)
        return res.status(400).json({ error: 'Word not found' });
    db.prepare('UPDATE attempts SET hints_used=hints_used+1 WHERE id=?').run(attempt.id);
    const hintMode = puzzle.hint_mode;
    if (hintMode === 'letter') {
        // Reveal first unknown letter (client tracks state, we just send whole word encrypted)
        res.json({ hintType: 'letter', word: word.word });
    }
    else {
        res.json({ hintType: 'text', hint: word.hint || `The answer is ${word.word.length} letters` });
    }
});
// POST /api/attempts/:id/complete — finalize the attempt
attemptRouter.post('/:id/complete', (req, res) => {
    const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id);
    if (!attempt)
        return res.status(404).json({ error: 'Not found' });
    if (attempt.completed_at)
        return res.status(400).json({ error: 'Already completed' });
    const { timeTakenSeconds } = req.body;
    const puzzle = db.prepare('SELECT * FROM puzzles WHERE id=?').get(attempt.puzzle_id);
    const score = calculateScore({
        timeTakenSeconds,
        hintsUsed: attempt.hints_used,
        wrongGuesses: attempt.wrong_guesses,
        timeLimitSeconds: puzzle.time_limit_seconds,
    });
    const completedAt = new Date().toISOString();
    db.prepare('UPDATE attempts SET completed_at=?, score=?, time_taken_seconds=? WHERE id=?')
        .run(completedAt, score, timeTakenSeconds, attempt.id);
    // Get rank
    const rank = db.prepare(`
    SELECT COUNT(*)+1 as rank FROM attempts
    WHERE puzzle_id=? AND score > ? AND completed_at IS NOT NULL
  `).get(attempt.puzzle_id, score).rank;
    res.json({ score, rank, timeTakenSeconds });
});
// POST /api/attempts/:id/progress — save incremental progress
attemptRouter.post('/:id/progress', (req, res) => {
    const { progress } = req.body;
    db.prepare('UPDATE attempts SET progress_json=? WHERE id=? AND completed_at IS NULL')
        .run(JSON.stringify(progress), req.params.id);
    res.json({ ok: true });
});
// GET /api/attempts/lookup — look up existing attempt by email+puzzleId
attemptRouter.get('/lookup', (req, res) => {
    const { puzzleId, email } = req.query;
    const attempt = db.prepare('SELECT * FROM attempts WHERE puzzle_id=? AND email=?')
        .get(puzzleId, email?.toLowerCase().trim());
    if (!attempt)
        return res.status(404).json({ error: 'Not found' });
    res.json(sanitizeAttempt(attempt));
});
function sanitizeAttempt(a) {
    return {
        id: a.id,
        puzzleId: a.puzzle_id,
        name: a.name,
        email: a.email,
        startedAt: a.started_at,
        completedAt: a.completed_at,
        score: a.score,
        timeTakenSeconds: a.time_taken_seconds,
        hintsUsed: a.hints_used,
        wrongGuesses: a.wrong_guesses,
        progress: a.progress_json ? JSON.parse(a.progress_json) : null,
    };
}
