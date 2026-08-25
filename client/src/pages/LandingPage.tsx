import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { copy } from '../lib/copy';
import { formatTime } from '../lib/utils';

export function LandingPage() {
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    api.getActivePuzzle()
      .then(setPuzzle)
      .catch(() => setError('no-puzzle'))
      .finally(() => setLoading(false));
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setFieldError('');
    if (!name.trim()) return setFieldError('Enter your name');
    if (!email.trim()) return setFieldError('Enter your work email');

    setSubmitting(true);
    try {
      const { attemptId } = await api.startAttempt(puzzle.id, name.trim(), email.trim());
      navigate(`/play/${puzzle.id}?attempt=${attemptId}`);
    } catch (err: any) {
      if (err.code === 'ALREADY_ATTEMPTED') {
        // Show their previous result
        navigate(`/results/${err.attempt.id}`);
      } else {
        setFieldError(err.error || copy.errorGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error === 'no-puzzle' || !puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4">🧩</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{copy.noPuzzle}</h1>
          <p className="text-slate-500">{copy.noPuzzleSub}</p>
          <a href="/leaderboard" className="mt-6 inline-block text-violet-600 hover:text-violet-700 font-medium text-sm">
            View past leaderboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-violet-50 via-white to-blue-50">
      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 text-white text-3xl mb-4 shadow-lg shadow-violet-200">
            🧩
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{copy.appName}</h1>
          <p className="text-slate-500 mt-1 text-sm">{copy.tagline}</p>
        </div>

        {/* Puzzle card */}
        <div className="card p-6 mb-4">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-800">{puzzle.title}</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              {puzzle.timeLimitSeconds && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                  ⏱ {formatTime(puzzle.timeLimitSeconds)} limit
                </span>
              )}
              {puzzle.endAt && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  Closes {new Date(puzzle.endAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleStart} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
              <input
                className="input"
                type="text"
                placeholder="Alex Chen"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
              <input
                className="input"
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {fieldError && (
              <p className="text-sm text-red-600 font-medium">{fieldError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2 text-base py-3"
            >
              {submitting ? 'Starting...' : copy.landingTitle + ' →'}
            </button>
          </form>

          <p className="text-xs text-slate-400 mt-4 text-center">
            One attempt per person. Your email is only used to track your score.
          </p>
        </div>

        <div className="text-center">
          <a href="/leaderboard" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
            View leaderboard →
          </a>
        </div>
      </div>
    </div>
  );
}
