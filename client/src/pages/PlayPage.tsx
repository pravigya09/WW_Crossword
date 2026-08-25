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

  // Grid state
  const [filledCells, setFilledCells] = useState<Record<string, string>>({});
  const [correctCells, setCorrectCells] = useState<Set<string>>(new Set());
  const [incorrectCells, setIncorrectCells] = useState<Set<string>>(new Set());
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [revealedHints, setRevealedHints] = useState<Record<string, string>>({});

  // Navigation state
  const [activeWordNumber, setActiveWordNumber] = useState(1);
  const [activeDirection, setActiveDirection] = useState<'across' | 'down'>('across');
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  // Game state
  const [startTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);

  const saveProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!puzzleId || !attemptId) {
      navigate('/');
      return;
    }
    api.getPuzzle(puzzleId!)
      .then(data => {
        setPuzzle(data);
        // Restore progress if any
        return api.getAttempt(attemptId);
      })
      .then(attempt => {
        if (attempt.completedAt) {
          navigate(`/results/${attemptId}`);
          return;
        }
        if (attempt.progress) {
          setFilledCells(attempt.progress.filledCells || {});
          setCorrectCells(new Set(attempt.progress.correctCells || []));
          setCompletedWords(new Set(attempt.progress.completedWords || []));
        }
      })
      .catch(() => setError('Failed to load puzzle'))
      .finally(() => setLoading(false));
  }, [puzzleId, attemptId, navigate]);

  // Set initial active cell to first word's start
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

    // Remove from incorrect when re-typed
    if (letter && incorrectCells.has(key)) {
      const s = new Set(incorrectCells);
      s.delete(key);
      setIncorrectCells(s);
    }

    debouncedSave(newFilled, Array.from(correctCells), Array.from(completedWords));
    checkWordCompletion(row, col, newFilled);
  }

  function checkWordCompletion(row: number, col: number, filled: Record<string, string>) {
    if (!puzzle) return;
    // Find words that contain this cell
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
      for (let i = 0; i < word.length; i++) {
        answer += filled[`${word.row + dr * i}-${word.col + dc * i}`] || '';
      }
      if (answer.length === word.length) {
        checkAnswer(word, answer);
      }
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
        setCorrectCells(prev => {
          const s = new Set(prev);
          wordCells.forEach(k => s.add(k));
          return s;
        });
        setCompletedWords(prev => {
          const s = new Set(prev);
          s.add(wordKey);
          return s;
        });
        checkAllComplete();
      } else {
        setWrongGuesses(w => w + 1);
        setIncorrectCells(prev => {
          const s = new Set(prev);
          wordCells.forEach(k => s.add(k));
          return s;
        });
        // Clear incorrect indicators after 1s
        setTimeout(() => {
          setIncorrectCells(prev => {
            const s = new Set(prev);
            wordCells.forEach(k => s.delete(k));
            return s;
          });
        }, 1000);
      }
    } catch {}
  }

  function checkAllComplete() {
    if (!puzzle) return;
    // Check if all words are completed
    setTimeout(() => {
      setCompletedWords(prev => {
        const total = puzzle.grid.placedWords.length;
        if (prev.size >= total && !completed) {
          handleComplete();
        }
        return prev;
      });
    }, 100);
  }

  async function handleComplete() {
    if (completed) return;
    setCompleted(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    try {
      await api.completeAttempt(attemptId, timeTaken);
      navigate(`/results/${attemptId}`);
    } catch {}
  }

  async function handleTimeExpire() {
    if (completed) return;
    setCompleted(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    try {
      await api.completeAttempt(attemptId, timeTaken);
      navigate(`/results/${attemptId}`);
    } catch {}
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
        // Reveal first empty letter
        const dr = word.direction === 'down' ? 1 : 0;
        const dc = word.direction === 'across' ? 1 : 0;
        for (let i = 0; i < word.length; i++) {
          const cellKey = `${word.row + dr * i}-${word.col + dc * i}`;
          if (!filledCells[cellKey]) {
            const newFilled = { ...filledCells, [cellKey]: result.word[i] };
            setFilledCells(newFilled);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">{puzzle.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">{doneCount}/{totalWords}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Timer
              timeLimitSeconds={puzzle.timeLimitSeconds}
              startTime={startTime}
              onExpire={handleTimeExpire}
            />
            <button
              onClick={() => setShowScoringInfo(s => !s)}
              className="text-slate-400 hover:text-slate-600 transition-colors text-lg"
              title="How scoring works"
            >ℹ️</button>
          </div>
        </div>

        {/* Scoring info popover */}
        {showScoringInfo && (
          <div className="absolute right-4 top-14 bg-white shadow-xl rounded-2xl border border-slate-100 p-4 z-50 w-72 animate-slide-up">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">How scoring works</h3>
            <ul className="space-y-1">
              {copy.scoringExplain.map(s => (
                <li key={s} className="text-xs text-slate-600 flex gap-2">
                  <span>•</span><span>{s}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowScoringInfo(false)} className="mt-3 text-xs text-violet-600 font-medium">
              Got it
            </button>
          </div>
        )}
      </header>

      {/* Mobile active clue bar */}
      <div className="lg:hidden sticky top-16 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {activeWord ? (
              <p className="text-sm font-medium text-slate-800 truncate">
                <span className="text-violet-600 font-bold mr-1">{activeWord.number} {activeWord.direction[0].toUpperCase()}.</span>
                {activeWord.clue}
              </p>
            ) : <p className="text-sm text-slate-400">Select a cell</p>}
          </div>
          <button
            onClick={handleHint}
            disabled={hintLoading || !activeWord}
            className="flex-shrink-0 text-xs btn bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-3 py-1.5"
          >
            💡 Hint <span className="text-amber-500 ml-1">{copy.hintCost}</span>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Grid */}
          <div className="flex-shrink-0 flex flex-col items-center">
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

            {/* Hint button below grid on mobile */}
            <div className="mt-4 text-center text-xs text-slate-400">
              {wrongGuesses > 0 && <span>{wrongGuesses} wrong guess{wrongGuesses > 1 ? 'es' : ''} · </span>}
              {hintsUsed > 0 && <span>{hintsUsed} hint{hintsUsed > 1 ? 's' : ''} used</span>}
            </div>
          </div>

          {/* Sidebar: clue list + hint button (desktop) */}
          <div className="flex-1 min-w-0">
            <div className="hidden lg:flex items-start justify-between mb-3">
              <div>
                {activeWord && (
                  <div className="mb-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-sm font-semibold text-violet-900">
                      {activeWord.number} {activeWord.direction} — {activeWord.clue}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleHint}
                disabled={hintLoading || !activeWord}
                className="flex-shrink-0 btn bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-sm ml-3"
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
