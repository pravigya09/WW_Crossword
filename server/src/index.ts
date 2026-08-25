import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminRouter } from './routes/admin.js';
import { puzzleRouter } from './routes/puzzles.js';
import { attemptRouter } from './routes/attempts.js';
import { leaderboardRouter } from './routes/leaderboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Trust Railway's reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: isDev ? 'http://localhost:5173' : false,
  credentials: true,
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ww-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isDev,
    httpOnly: true,
    sameSite: isDev ? 'lax' : 'strict',
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

app.use('/api/admin', adminRouter);
app.use('/api/puzzles', puzzleRouter);
app.use('/api/attempts', attemptRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Serve frontend in production
if (!isDev) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Wonderful Wednesdays server running on port ${PORT}`);
});
