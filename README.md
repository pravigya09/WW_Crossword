# Wonderful Wednesdays 🧩

A team crossword app — one puzzle, one attempt per person, live leaderboard.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example server/.env
# Edit server/.env — at minimum set ADMIN_PASSWORD

# 3. Start dev servers (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Admin panel: http://localhost:5173/admin

## Environment variables

Set these in `server/.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_PASSWORD` | Yes | `changeme` | Password for the `/admin` panel |
| `SESSION_SECRET` | Yes | dev fallback | Secret for signing session cookies — use a long random string in prod |
| `PORT` | No | `3001` | Port the Express server listens on |
| `DB_PATH` | No | `./data/ww.db` | Path to the SQLite database file |
| `NODE_ENV` | No | `development` | Set to `production` for prod builds |

## Workflow

1. Go to `/admin`, enter your password
2. Add clue/answer pairs in the **Clues** tab
3. Switch to **Generate**, set a title, time window, and time limit, then click **Generate Crossword ✨**
4. Preview the layout — regenerate if you want a different arrangement
5. Click **Publish Puzzle 🚀**
6. Share the root URL (`/`) with your team — everyone lands there, enters their name + email, and plays

## Deployment (Railway / Render / Fly.io)

```bash
# Build
npm run build

# Start (serves API + static frontend from single Node process)
npm start
```

The app serves the built React frontend from Express in production mode. Mount a **persistent disk** at the `DB_PATH` directory so the SQLite file survives restarts.

**Recommended persistent disk path:** `/app/data` → set `DB_PATH=/app/data/ww.db`

### Fly.io example

```toml
# fly.toml
[mounts]
  source = "ww_data"
  destination = "/app/data"

[env]
  NODE_ENV = "production"
  DB_PATH = "/app/data/ww.db"
  PORT = "8080"
```

Set secrets:
```bash
fly secrets set ADMIN_PASSWORD=yourpassword SESSION_SECRET=yoursecret
```

## Tech stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite via better-sqlite3
- **Crossword generation**: Constraint-based placement (longest words first, maximize intersections, backtrack on conflict)

## Scoring formula

| Factor | Deduction |
|---|---|
| Base score | 1000 pts |
| Time (every 2 seconds) | −1 pt (max −300) |
| Per hint used | −50 pts |
| Per wrong guess | −10 pts (max −200) |
| Finish in under half the time limit | +100 pts bonus |
