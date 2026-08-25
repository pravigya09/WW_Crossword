import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { copy } from '../lib/copy';
import { formatTime } from '../lib/utils';

export function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<number | null>(null);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!attemptId) return;
    api.getAttempt(attemptId)
      .then(async a => {
        setAttempt(a);
        // Get rank from leaderboard
        if (a.completedAt) {
          const lb = await api.getLeaderboard(a.puzzleId).catch(() => []);
          const entry = lb.find((e: any) => e.email === a.email);
          if (entry) setRank(entry.rank);
        }
      })
      .finally(() => setLoading(false));
  }, [attemptId]);

  useEffect(() => {
    if (attempt?.completedAt && !confettiFired.current) {
      confettiFired.current = true;
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.4 },
          colors: ['#7c3aed', '#4f6ef7', '#06b6d4', '#f59e0b', '#10b981'],
        });
      }, 300);
    }
  }, [attempt]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Attempt not found</p>
      </div>
    );
  }

  const isCompleted = !!attempt.completedAt;
  const isAlreadyPlayed = true; // We're on results page

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-bounce-in">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">{isCompleted ? '🎉' : '⏱️'}</div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {isCompleted ? copy.completionTitle : copy.completionTimedOut}
          </h1>
          <p className="text-slate-500 mt-1">{attempt.name}</p>
        </div>

        <div className="card p-6 mb-4">
          {/* Score */}
          <div className="text-center mb-6">
            <div className="text-5xl font-extrabold text-violet-600 tabular-nums">
              {attempt.score ?? 0}
            </div>
            <div className="text-sm text-slate-500 mt-1 font-medium">{copy.scoreLabel}</div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard
              label="Time"
              value={attempt.timeTakenSeconds ? formatTime(attempt.timeTakenSeconds) : '—'}
              icon="⏱️"
            />
            <StatCard
              label="Hints"
              value={String(attempt.hintsUsed)}
              icon="💡"
            />
            <StatCard
              label="Misses"
              value={String(attempt.wrongGuesses)}
              icon="❌"
            />
          </div>

          {rank && (
            <div className="text-center py-3 bg-violet-50 rounded-xl border border-violet-100">
              <span className="text-2xl mr-2">{copy.medals[rank - 1] || '🏅'}</span>
              <span className="font-bold text-violet-800">Rank #{rank}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={`/leaderboard/${attempt.puzzleId}`}
            className="btn-primary w-full text-center"
          >
            {copy.viewLeaderboard}
          </a>
          <a href="/" className="btn-secondary w-full text-center">
            ← Home
          </a>
        </div>

        {/* Scoring breakdown */}
        <details className="mt-4 cursor-pointer">
          <summary className="text-xs text-slate-400 text-center hover:text-slate-600 transition-colors">
            How was my score calculated?
          </summary>
          <div className="mt-3 card p-4">
            <ul className="space-y-1.5">
              {copy.scoringExplain.map(s => (
                <li key={s} className="text-xs text-slate-600 flex gap-2">
                  <span className="text-violet-400">•</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-xl font-bold text-slate-800 tabular-nums">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
