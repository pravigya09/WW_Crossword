import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { copy } from '../lib/copy';
import { CrosswordGrid } from '../components/CrosswordGrid';

type Tab = 'clues' | 'generate' | 'puzzles';

interface Clue { id: string; clue: string; answer: string; hint?: string; }

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [tab, setTab] = useState<Tab>('clues');

  useEffect(() => {
    api.adminMe()
      .then(() => setAuthenticated(true))
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await api.adminLogin(password);
      setAuthenticated(true);
    } catch {
      setLoginError('Wrong password. Try again.');
    } finally {
      setLoginLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🔐</div>
            <h1 className="text-2xl font-bold text-white">{copy.adminTitle}</h1>
          </div>
          <form onSubmit={handleLogin} className="card p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {loginError && <p className="text-red-600 text-sm mb-3">{loginError}</p>}
            <button type="submit" disabled={loginLoading} className="btn-primary w-full">
              {loginLoading ? 'Checking...' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧩</span>
          <h1 className="font-bold">{copy.adminTitle}</h1>
        </div>
        <button
          onClick={async () => { await api.adminLogout(); setAuthenticated(false); }}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {([['clues', '📝 Clues'], ['generate', '✨ Generate'], ['puzzles', '📚 Puzzles']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'clues' && <CluesTab />}
        {tab === 'generate' && <GenerateTab onPublished={() => setTab('puzzles')} />}
        {tab === 'puzzles' && <PuzzlesTab />}
      </div>
    </div>
  );
}

// ─── Clues Tab ───────────────────────────────────────────────────────────────

function CluesTab() {
  const [clues, setClues] = useState<Clue[]>([]);
  const [loading, setLoading] = useState(true);
  const [clue, setClue] = useState('');
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getClues().then(setClues).finally(() => setLoading(false));
  }, []);

  function handleAnswerChange(val: string) {
    const cleaned = val.toUpperCase().replace(/[^A-Z]/g, '');
    setAnswer(cleaned);
    setAnswerError(val !== cleaned && val !== '' ? 'Letters only — non-letter characters removed' : '');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clue.trim()) return;
    const cleaned = answer.toUpperCase().replace(/[^A-Z]/g, '');
    if (!cleaned) return setAnswerError('Answer must contain letters');
    setSaving(true);
    try {
      if (editId) {
        await api.updateClue(editId, clue.trim(), cleaned, hint || undefined);
        setClues(prev => prev.map(c => c.id === editId ? { ...c, clue: clue.trim(), answer: cleaned, hint: hint || undefined } : c));
        setEditId(null);
      } else {
        const added = await api.addClue(clue.trim(), cleaned, hint || undefined) as Clue;
        setClues(prev => [...prev, added]);
      }
      setClue(''); setAnswer(''); setHint('');
    } catch (err: any) {
      setAnswerError(err.error || 'Failed to save');
    }
    setSaving(false);
  }

  function startEdit(c: Clue) {
    setEditId(c.id); setClue(c.clue); setAnswer(c.answer); setHint(c.hint || '');
  }

  async function handleDelete(id: string) {
    await api.deleteClue(id);
    setClues(prev => prev.filter(c => c.id !== id));
    if (editId === id) { setEditId(null); setClue(''); setAnswer(''); setHint(''); }
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit form */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-4">{editId ? 'Edit clue' : 'Add a clue'}</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Clue text</label>
              <input className="input" placeholder="Opposite of left" value={clue} onChange={e => setClue(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Answer (letters only)</label>
              <input
                className="input font-mono uppercase tracking-widest"
                placeholder="RIGHT"
                value={answer}
                onChange={e => handleAnswerChange(e.target.value)}
                required
              />
              {answerError && <p className="text-xs text-amber-600 mt-1">{answerError}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hint (optional — shown to player on request)</label>
            <input className="input" placeholder="Think: a direction" value={hint} onChange={e => setHint(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editId ? 'Update clue' : 'Add clue'}
            </button>
            {editId && (
              <button type="button" className="btn-secondary" onClick={() => { setEditId(null); setClue(''); setAnswer(''); setHint(''); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Clues list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : clues.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No clues yet — add some above!</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Clue</th>
                <th className="text-left py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Answer</th>
                <th className="text-left py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Hint</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {clues.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 px-4 text-slate-700">{c.clue}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-violet-700 tracking-widest">{c.answer}</td>
                  <td className="py-2.5 px-4 text-slate-500 text-xs hidden sm:table-cell">{c.hint || '—'}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(c)} className="text-xs btn-secondary py-1 px-2">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs btn-danger py-1 px-2">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {clues.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
            {clues.length} clue{clues.length !== 1 ? 's' : ''} · {new Set(clues.map(c => c.answer.length)).size > 1 ? 'varied lengths' : `${clues[0]?.answer.length} letters each`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab({ onPublished }: { onPublished: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [grid, setGrid] = useState<any>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Wednesday Crossword');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [hintMode, setHintMode] = useState<'text' | 'letter'>('text');
  const [publishing, setPublishing] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setGrid(null);
    try {
      const result = await api.generateCrossword() as any;
      if (!result.placedWords?.length) {
        setError(copy.errorNoClues);
      } else {
        setGrid(result);
      }
    } catch (err: any) {
      setError(err.error || copy.errorGeneric);
    }
    setGenerating(false);
  }

  async function handlePublish() {
    if (!grid) return;
    setPublishing(true);
    try {
      await api.publishPuzzle({
        title,
        grid,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        timeLimitSeconds: timeLimit ? parseInt(timeLimit) * 60 : undefined,
        hintMode,
      });
      onPublished();
    } catch (err: any) {
      setError(err.error || 'Failed to publish');
    }
    setPublishing(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-4">Puzzle settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Puzzle title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Opens at (optional)</label>
            <input type="datetime-local" className="input" value={startAt} onChange={e => setStartAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Closes at (optional)</label>
            <input type="datetime-local" className="input" value={endAt} onChange={e => setEndAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Time limit (minutes, optional)</label>
            <input type="number" className="input" placeholder="e.g. 15" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} min="1" max="120" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hint type</label>
            <select className="input" value={hintMode} onChange={e => setHintMode(e.target.value as 'text' | 'letter')}>
              <option value="text">Show hint text</option>
              <option value="letter">Reveal one letter</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleGenerate} disabled={generating} className="btn-primary">
          {generating ? 'Generating...' : copy.generateBtn}
        </button>
        {grid && (
          <button onClick={handlePublish} disabled={publishing} className="btn bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500">
            {publishing ? 'Publishing...' : copy.publishBtn}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {grid && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Preview</h3>
            <div className="flex gap-2 text-xs text-slate-500">
              <span>{grid.placedWords?.length} words placed</span>
              {grid.unplacedWords?.length > 0 && (
                <span className="text-amber-600 font-medium">⚠ {grid.unplacedWords.length} couldn't fit</span>
              )}
            </div>
          </div>

          {grid.unplacedWords?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
              <strong>Couldn't place:</strong> {grid.unplacedWords.join(', ')} — consider removing conflicting answers or regenerating.
            </div>
          )}

          <div className="overflow-x-auto flex justify-center">
            <CrosswordGrid
              cells={grid.cells.map((row: any[]) => row.map((c: any) => c ? { wordIds: c.wordIds } : null))}
              words={grid.placedWords.map((w: any) => ({ ...w, length: w.word.length }))}
              answers={{}}
              filledCells={Object.fromEntries(
                grid.placedWords.flatMap((w: any) => {
                  const dr = w.direction === 'down' ? 1 : 0;
                  const dc = w.direction === 'across' ? 1 : 0;
                  return w.word.split('').map((l: string, i: number) => [`${w.row + dr * i}-${w.col + dc * i}`, l]);
                })
              )}
              correctCells={new Set()}
              incorrectCells={new Set()}
              onCellChange={() => {}}
              onWordSelect={() => {}}
              activeWordNumber={-1}
              activeDirection="across"
              activeCell={null}
              onActiveCell={() => {}}
              disabled
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Puzzles Tab ──────────────────────────────────────────────────────────────

function PuzzlesTab() {
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    api.getPuzzles()
      .then(p => {
        setPuzzles(p);
        p.forEach((puzzle: any) => {
          api.getPuzzleStats(puzzle.id).then(s => {
            setStats(prev => ({ ...prev, [puzzle.id]: s }));
          });
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm(copy.unpublishWarning)) return;
    await api.deletePuzzle(id);
    setPuzzles(prev => prev.filter(p => p.id !== id));
  }

  function formatDuration(secs: number | null) {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="space-y-4">
      {loading && <div className="text-center py-8 text-slate-400">Loading...</div>}
      {!loading && puzzles.length === 0 && (
        <div className="card p-12 text-center text-slate-400">No puzzles published yet.</div>
      )}
      {puzzles.map(p => {
        const s = stats[p.id];
        return (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800">{p.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Created {new Date(p.created_at).toLocaleDateString()}
                  {p.start_at && ` · Opens ${new Date(p.start_at).toLocaleDateString()}`}
                  {p.end_at && ` · Closes ${new Date(p.end_at).toLocaleDateString()}`}
                </p>
                <p className="text-xs text-violet-600 mt-1 font-mono break-all">
                  /play/{p.id}
                </p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="btn-danger text-xs flex-shrink-0">Delete</button>
            </div>

            {s && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{s.total_attempts}</div>
                  <div className="text-xs text-slate-400">attempts</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{s.completions}</div>
                  <div className="text-xs text-slate-400">completed</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{Math.round(s.avg_score) || '—'}</div>
                  <div className="text-xs text-slate-400">avg score</div>
                </div>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <a href={`/leaderboard/${p.id}`} className="btn-secondary text-xs">View leaderboard</a>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/`)}
                className="btn-secondary text-xs"
              >
                Copy share link
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
