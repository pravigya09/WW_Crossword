import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { copy } from '../lib/copy';
import { formatTime } from '../lib/utils';

export function LeaderboardPage() {
  const { puzzleId: paramPuzzleId } = useParams<{ puzzleId?: string }>();
  const [entries, setEntries] = useState<any[]>([]);
  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [puzzleId, setPuzzleId] = useState<string | null>(paramPuzzleId || null);

  useEffect(() => {
    const loadPuzzle = paramPuzzleId ? api.getPuzzle(paramPuzzleId) : api.getActivePuzzle();
    loadPuzzle
      .then(p => { setPuzzle(p); setPuzzleId(p.id); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paramPuzzleId]);

  useEffect(() => {
    if (!puzzleId) return;
    const fetch = () => api.getLeaderboard(puzzleId).then(setEntries).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [puzzleId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{copy.leaderboardTitle}</h1>
          {puzzle && <p className="text-slate-500 mt-1 font-medium text-sm sm:text-base">{puzzle.title}</p>}
          <p className="text-xs text-slate-400 mt-1">Updates every 10 seconds</p>
        </div>

        {entries.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">🏁</div>
            <p className="text-slate-500">{copy.leaderboardEmpty}</p>
            {puzzleId && (
              <a href={`/?puzzle=${puzzleId}`} className="btn-primary mt-4 inline-block">Play now →</a>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Mobile: stacked rows */}
            <div className="sm:hidden divide-y divide-slate-100">
              {entries.map((entry, idx) => {
                const isTop3 = idx < 3;
                return (
                  <div key={entry.email} className={`px-4 py-3 flex items-center gap-3 ${isTop3 ? 'bg-violet-50/50' : ''}`}>
                    <span className="text-xl w-8 text-center flex-shrink-0">
                      {isTop3 ? copy.medals[idx] : <span className="text-sm font-bold text-slate-400">#{entry.rank}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{entry.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.timeTakenSeconds ? formatTime(entry.timeTakenSeconds) : '—'}
                        {entry.hintsUsed > 0 && ` · ${entry.hintsUsed} hint${entry.hintsUsed !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <span className={`font-bold tabular-nums flex-shrink-0 ${isTop3 ? 'text-violet-600 text-base' : 'text-slate-700 text-sm'}`}>
                      {entry.score}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-12">Rank</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Name</th>
                    <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Score</th>
                    <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Time</th>
                    <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Hints</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const isTop3 = idx < 3;
                    return (
                      <tr key={entry.email} className={`border-b border-slate-50 transition-colors ${isTop3 ? 'bg-violet-50/30' : 'hover:bg-slate-50'}`}>
                        <td className="py-3 px-4">
                          <span className="font-bold text-base">{isTop3 ? copy.medals[idx] : `#${entry.rank}`}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{entry.name}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-bold tabular-nums ${isTop3 ? 'text-violet-600' : 'text-slate-700'}`}>{entry.score}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 tabular-nums">
                          {entry.timeTakenSeconds ? formatTime(entry.timeTakenSeconds) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">{entry.hintsUsed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-violet-600 hover:text-violet-700 font-medium">← Play the puzzle</a>
        </div>
      </div>
    </div>
  );
}
