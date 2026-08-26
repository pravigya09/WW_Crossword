import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { copy } from '../lib/copy';
import { CrosswordGrid, GridWord, CellState } from '../components/CrosswordGrid';
import { ClueList } from '../components/ClueList';
import { Timer } from '../components/Timer';

export function PlayPage() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const attemptId = searchParams.get('attempt')!;

  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filledCells, setFilledCells] = useState<Record<string, string>>({});
  const [correctCells, setCorrectCells] = useState<Set<string>>(new Set());
  const [incorrectCells, setIncorrectCells] = useState<Set<string>>(new Set());
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [revealedHints, setRevealedHints] = useState<Record<string, string>>({});

  const [activeWordNumber, setActiveWordNumber] = useState(1);
  const [activeDirection, setActiveDirection] = useState<'across' | 'down'>('across');
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  const [startTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [clueDrawerOpen, setClueDrawerOpen] = useState(false);

  const saveProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!puzzleId || !attemptId) { navigate('/'); return; }
    api.getPuzzle(puzzleId!)
      .then(data => { setPuzzle(data); return api.getAttempt(attemptId); })
      .then(attempt => {
        if (attempt.completedAt) { navigate(`/results/${attemptId}`); return; }
        if (attempt.progress) {
          setFilledCells(attempt.progress.filledCells || {});
          setCorrectCells(new Set(attempt.progress.correctCells || []));
          setCompletedWords(new Set(attempt.progress.completedWords || []));
        }
      })
      .catch(() => setError('Failed to load puzzle'))
      .finally(() => setLoading(false));
  }, [puzzleId, attemptId, navigate]);

  useEffect(() => {
    if (!puzzle) return;
    const firstWord = puzzle.grid.placedWords
      .filter((w: GridWord) => w.direction === 'across')
      .sort((a: GridWord, b: GridWord) => a.number - b.number)[0];
    if (firstWord) {
      setActiveWordNumber(firstWord.number);
      setActiveCell({ row: firstWord.row, col: firstWord.col });
    }
  }, [puzzle]);

  const debouncedSave = useCallback((filled: Record<string, string>, correct: string[], completed: string[]) => {
    if (saveProgressTimer.current) clearTimeout(saveProgressTimer.current);
    saveProgressTimer.current = setTimeout(() => {
      api.saveProgress(attemptId, { filledCells: filled, correctCells: correct, completedWords: completed }).catch(() => {});
    }, 2000);
  }, [attemptId]);

  function handleCellChange(row: number, col: number, letter: string) {
    const key = `${row}-${col}`;
    const newFilled = { ...filledCells, [key]: letter };
    if (!letter) delete newFilled[key];
    setFilledCells(newFilled);
    if (letter && incorrectCells.has(key)) {
      const s = new Set(incorrectCells); s.delete(key); setIncorrectCells(s);
    }
    debouncedSave(newFilled, Array.from(correctCells), Array.from(completedWords));
    checkWordCompletion(row, col, newFilled);
  }

  function checkWordCompletion(row: number, col: number, filled: Record<string, string>) {
    if (!puzzle) return;
    const relevantWords = puzzle.grid.placedWords.filter((w: GridWord) => {
      const dr = w.direction === 'down' ? 1 : 0;
      const dc = w.direction === 'across' ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        if (w.row + dr * i === row && w.col + dc * i === col) return true;
      }
      return false;
    });
    for (const word of relevantWords) {
      const dr = word.direction === 'down' ? 1 : 0;
      const dc = word.direction === 'across' ? 1 : 0;
      let answer = '';
      for (let i = 0; i < word.length; i++) answer += filled[`${word.row + dr * i}-${word.col + dc * i}`] || '';
      if (answer.length === word.length) checkAnswer(word, answer);
    }
  }

  async function checkAnswer(word: GridWord, answer: string) {
    try {
      const { correct, word: correctWord } = await api.checkAnswer(attemptId, word.number, word.direction, answer);
      const wordKey = `${word.number}-${word.direction}`;
      const dr = word.direction === 'down' ? 1 : 0;
      const dc = word.direction === 'across' ? 1 : 0;
      const wordCells = Array.from({ length: word.length }, (_, i) => `${word.row + dr * i}-${word.col + dc * i}`);
      if (correct) {
        setCorrectCells(prev => { const s = new Set(prev); wordCells.forEach(k => s.add(k)); return s; });
        setCompletedWords(prev => { const s = new Set(prev); s.add(wordKey); return s; });
        checkAllComplete();
      } else {
        setWrongGuesses(w => w + 1);
        setIncorrectCells(prev => { const s = new Set(prev); wordCells.forEach(k => s.add(k)); return s; });
        setTimeout(() => {
          setIncorrectCells(prev => { const s = new Set(prev); wordCells.forEach(k => s.delete(k)); return s; });
        }, 1000);
      }
    } catch {}
  }

  function checkAllComplete() {
    if (!puzzle) return;
    setTimeout(() => {
      setCompletedWords(prev => {
        if (prev.size >= puzzle.grid.placedWords.length && !completed) handleComplete();
        return prev;
      });
    }, 100);
  }

  async function handleComplete() {
    if (completed) return;
    setCompleted(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    try { await api.completeAttempt(attemptId, timeTaken); navigate(`/results/${attemptId}`); } catch {}
  }

  async function handleTimeExpire() {
    if (completed) return;
    setCompleted(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    try { await api.completeAttempt(attemptId, timeTaken); navigate(`/results/${attemptId}`); } catch {}
  }

  async function handleHint() {
    if (!puzzle || hintLoading) return;
    const word = puzzle.grid.placedWords.find(
      (w: GridWord) => w.number === activeWordNumber && w.direction === activeDirection
    );
    if (!word) return;
    setHintLoading(true);
    try {
      const result = await api.requestHint(attemptId, activeWordNumber, activeDirection);
      setHintsUsed(h => h + 1);
      const key = `${activeWordNumber}-${activeDirection}`;
      if (result.hintType === 'letter') {
        const dr = word.direction === 'down' ? 1 : 0;
        const dc = word.direction === 'across' ? 1 : 0;
        for (let i = 0; i < word.length; i++) {
          const cellKey = `${word.row + dr * i}-${word.col + dc * i}`;
          if (!filledCells[cellKey]) {
            setFilledCells(prev => ({ ...prev, [cellKey]: result.word[i] }));
            break;
          }
        }
      } else {
        setRevealedHints(prev => ({ ...prev, [key]: result.hint }));
      }
    } catch {}
    setHintLoading(false);
  }

  function handleWordSelect(number: number, direction: 'across' | 'down') {
    setActiveWordNumber(number);
    setActiveDirection(direction);
    const word = puzzle?.grid.placedWords.find((w: GridWord) => w.number === number && w.direction === direction);
    if (word) setActiveCell({ row: word.row, col: word.col });
  }

  // Navigate to previous/next word (mobile clue bar arrows)
  function goToAdjacentWord(delta: 1 | -1) {
    if (!puzzle) return;
    const allWords: GridWord[] = [...puzzle.grid.placedWords].sort((a: GridWord, b: GridWord) => {
      if (a.direction !== b.direction) return a.direction === 'across' ? -1 : 1;
      return a.number - b.number;
    });
    const idx = allWords.findIndex(w => w.number === activeWordNumber && w.direction === activeDirection);
    const next = allWords[(idx + delta + allWords.length) % allWords.length];
    if (next) {
      setActiveWordNumber(next.number);
      setActiveDirection(next.direction);
      setActiveCell({ row: next.row, col: next.col });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600">{error || 'Puzzle not found'}</p>
          <a href="/" className="btn-primary mt-4 inline-block">← Back</a>
        </div>
      </div>
    );
  }

  const words: GridWord[] = puzzle.grid.placedWords;
  const gridCells: (CellState | null)[][] = puzzle.grid.cells;
  const activeWord = words.find((w: GridWord) => w.number === activeWordNumber && w.direction === activeDirection);
  const totalWords = words.length;
  const doneCount = completedWords.size;
  const progress = Math.round((doneCount / totalWords) * 100);
  const activeHint = revealedHints[`${activeWordNumber}-${activeDirection}`];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50">

      {/* ── Compact sticky header ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="px-3 py-2 flex items-center justify-between gap-3">
          {/* Progress + title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-20 sm:w-32 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">{doneCount}/{totalWords}</span>
            <h1 className="hidden sm:block text-sm font-bold text-slate-700 truncate">{puzzle.title}</h1>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Timer
              timeLimitSeconds={puzzle.timeLimitSeconds}
              startTime={startTime}
              onExpire={handleTimeExpire}
            />
            <button
              onClick={() => setShowScoringInfo(s => !s)}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              title="How scoring works"
            >ℹ️</button>
          </div>
        </div>

        {showScoringInfo && (
          <div className="absolute right-3 top-12 bg-white shadow-xl rounded-2xl border border-slate-100 p-4 z-50 w-72 animate-slide-up">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">How scoring works</h3>
            <ul className="space-y-1">
              {copy.scoringExplain.map(s => (
                <li key={s} className="text-xs text-slate-600 flex gap-2"><span>•</span><span>{s}</span></li>
              ))}
            </ul>
            <button onClick={() => setShowScoringInfo(false)} className="mt-3 text-xs text-violet-600 font-medium">Got it</button>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════
          MOBILE LAYOUT  (<md)
      ══════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col">

        {/* Grid — full viewport width, no horizontal padding */}
        <div className="px-2 pt-3 pb-1">
          <CrosswordGrid
            cells={gridCells}
            words={words}
            answers={{}}
            filledCells={filledCells}
            correctCells={correctCells}
            incorrectCells={incorrectCells}
            onCellChange={handleCellChange}
            onWordSelect={handleWordSelect}
            activeWordNumber={activeWordNumber}
            activeDirection={activeDirection}
            activeCell={activeCell}
            onActiveCell={(r, c) => setActiveCell({ row: r, col: c })}
            disabled={completed}
          />
        </div>

        {/* Active clue bar — prev / clue text / next + hint */}
        <div className="sticky top-[48px] z-20 bg-white border-t border-b border-slate-100 shadow-sm">
          <div className="flex items-stretch">
            {/* Prev word */}
            <button
              onClick={() => goToAdjacentWord(-1)}
              className="px-3 flex items-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors text-xl font-light border-r border-slate-100"
              aria-label="Previous clue"
            >‹</button>

            {/* Clue text */}
            <div className="flex-1 min-w-0 px-3 py-2.5">
              {activeWord ? (
                <>
                  <p className="text-sm leading-snug text-slate-800">
                    <span className="text-violet-600 font-bold mr-1">
                      {activeWord.number}{activeWord.direction === 'across' ? 'A' : 'D'}.
                    </span>
                    {activeWord.clue}
                  </p>
                  {activeHint && (
                    <p className="text-xs text-amber-600 mt-0.5">💡 {activeHint}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">Tap a cell to begin</p>
              )}
            </div>

            {/* Next word */}
            <button
              onClick={() => goToAdjacentWord(1)}
              className="px-3 flex items-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors text-xl font-light border-l border-r border-slate-100"
              aria-label="Next clue"
            >›</button>

            {/* Hint */}
            <button
              onClick={handleHint}
              disabled={hintLoading || !activeWord || completed}
              className="px-3 flex items-center gap-1 text-amber-600 hover:bg-amber-50 transition-colors text-sm font-semibold disabled:opacity-40"
              aria-label="Get hint"
            >
              <span>💡</span>
              <span className="text-xs text-amber-500">{copy.hintCost}</span>
            </button>
          </div>
        </div>

        {/* Stats row */}
        {(wrongGuesses > 0 || hintsUsed > 0) && (
          <div className="px-4 py-1.5 text-xs text-slate-400 flex gap-3 bg-white border-b border-slate-50">
            {wrongGuesses > 0 && <span>{wrongGuesses} wrong guess{wrongGuesses !== 1 ? 'es' : ''}</span>}
            {hintsUsed > 0 && <span>{hintsUsed} hint{hintsUsed !== 1 ? 's' : ''} used</span>}
          </div>
        )}

        {/* Collapsible clue drawer */}
        <div className="bg-white border-b border-slate-100">
          <button
            onClick={() => setClueDrawerOpen(o => !o)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
          >
            <span>View all clues</span>
            <span className="text-slate-400 text-xs">{clueDrawerOpen ? '▲' : '▼'}</span>
          </button>
          {clueDrawerOpen && (
            <div className="px-4 pb-3 max-h-64 overflow-y-auto border-t border-slate-100">
              <ClueList
                words={words}
                activeWordNumber={activeWordNumber}
                activeDirection={activeDirection}
                completedWords={completedWords}
                onSelect={(num, dir) => { handleWordSelect(num, dir); setClueDrawerOpen(false); }}
                hints={revealedHints}
              />
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP LAYOUT  (md+)
      ══════════════════════════════════════════ */}
      <main className="hidden md:block max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">
          {/* Grid */}
          <div className="flex-shrink-0 w-full max-w-lg">
            <CrosswordGrid
              cells={gridCells}
              words={words}
              answers={{}}
              filledCells={filledCells}
              correctCells={correctCells}
              incorrectCells={incorrectCells}
              onCellChange={handleCellChange}
              onWordSelect={handleWordSelect}
              activeWordNumber={activeWordNumber}
              activeDirection={activeDirection}
              activeCell={activeCell}
              onActiveCell={(r, c) => setActiveCell({ row: r, col: c })}
              disabled={completed}
            />
            <div className="mt-3 text-center text-xs text-slate-400">
              {wrongGuesses > 0 && <span>{wrongGuesses} wrong guess{wrongGuesses !== 1 ? 'es' : ''} · </span>}
              {hintsUsed > 0 && <span>{hintsUsed} hint{hintsUsed !== 1 ? 's' : ''} used</span>}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex-1 min-w-0">
                {activeWord && (
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-sm font-semibold text-violet-900">
                      {activeWord.number} {activeWord.direction} — {activeWord.clue}
                    </p>
                    {activeHint && <p className="text-xs text-amber-600 mt-1">💡 {activeHint}</p>}
                  </div>
                )}
              </div>
              <button
                onClick={handleHint}
                disabled={hintLoading || !activeWord || completed}
                className="flex-shrink-0 btn bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-sm"
              >
                💡 {copy.hintButton} <span className="text-amber-500">{copy.hintCost}</span>
              </button>
            </div>

            <div className="card p-4 max-h-[60vh] overflow-y-auto">
              <ClueList
                words={words}
                activeWordNumber={activeWordNumber}
                activeDirection={activeDirection}
                completedWords={completedWords}
                onSelect={handleWordSelect}
                hints={revealedHints}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
