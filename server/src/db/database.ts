import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/ww.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const _db = new DatabaseSync(DB_PATH);

_db.exec('PRAGMA journal_mode = WAL');
_db.exec('PRAGMA foreign_keys = ON');

_db.exec(`
  CREATE TABLE IF NOT EXISTS puzzles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    grid_json TEXT NOT NULL,
    clues_json TEXT NOT NULL,
    start_at TEXT,
    end_at TEXT,
    time_limit_seconds INTEGER,
    hint_mode TEXT NOT NULL DEFAULT 'text',
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clue_sets (
    id TEXT PRIMARY KEY,
    puzzle_id TEXT,
    clue TEXT NOT NULL,
    answer TEXT NOT NULL,
    hint TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    puzzle_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    score INTEGER,
    time_taken_seconds INTEGER,
    hints_used INTEGER NOT NULL DEFAULT 0,
    wrong_guesses INTEGER NOT NULL DEFAULT 0,
    progress_json TEXT,
    FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE,
    UNIQUE(puzzle_id, email)
  );
`);

export type Row = Record<string, unknown>;

type SQLValue = string | number | null | bigint | Uint8Array;

// Thin wrapper: prepare returns an object with get/all/run that accept spread args
export const db = {
  prepare(sql: string) {
    const s = _db.prepare(sql);
    return {
      get: (...args: SQLValue[]) => s.get(...(args as Parameters<typeof s.get>)) as Row | undefined,
      all: (...args: SQLValue[]) => s.all(...(args as Parameters<typeof s.all>)) as Row[],
      run: (...args: SQLValue[]) => { s.run(...(args as Parameters<typeof s.run>)); },
    };
  },
  exec(sql: string) { _db.exec(sql); },
  transaction(fn: () => void): void { fn(); },
};

export default db;
