import { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from '../lib/utils';

export interface GridWord {
  clue: string;
  hint?: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
  number: number;
  length: number;
}

export interface CellState {
  wordIds: number[];
}

interface Props {
  cells: (CellState | null)[][];
  words: GridWord[];
  answers: Record<string, string>;
  filledCells: Record<string, string>;
  correctCells: Set<string>;
  incorrectCells: Set<string>;
  onCellChange: (row: number, col: number, letter: string) => void;
  onWordSelect: (wordNumber: number, direction: 'across' | 'down') => void;
  activeWordNumber: number;
  activeDirection: 'across' | 'down';
  activeCell: { row: number; col: number } | null;
  onActiveCell: (row: number, col: number) => void;
  disabled?: boolean;
}

export function CrosswordGrid({
  cells, words, filledCells, correctCells, incorrectCells,
  onCellChange, onWordSelect, activeWordNumber, activeDirection,
  activeCell, onActiveCell, disabled,
}: Props) {
  const size = cells.length;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width so the grid fills all available space
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    obs.observe(containerRef.current);
    setContainerWidth(containerRef.current.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  const cellSize = Math.max(
    Math.floor((containerWidth || window.innerWidth - 32) / size),
    28
  );

  const getWordAt = useCallback((row: number, col: number, dir: 'across' | 'down') => {
    return words.find(w => {
      const dr = w.direction === 'down' ? 1 : 0;
      const dc = w.direction === 'across' ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        if (w.row + dr * i === row && w.col + dc * i === col && w.direction === dir) return true;
      }
      return false;
    });
  }, [words]);

  const getWordCells = useCallback((wordNumber: number, dir: 'across' | 'down') => {
    const w = words.find(x => x.number === wordNumber && x.direction === dir);
    if (!w) return new Set<string>();
    const s = new Set<string>();
    const dr = w.direction === 'down' ? 1 : 0;
    const dc = w.direction === 'across' ? 1 : 0;
    for (let i = 0; i < w.length; i++) s.add(`${w.row + dr * i}-${w.col + dc * i}`);
    return s;
  }, [words]);

  const activeWordCells = getWordCells(activeWordNumber, activeDirection);

  function cellNumberAt(row: number, col: number): number | null {
    const w = words.find(w => w.row === row && w.col === col);
    return w ? w.number : null;
  }

  function handleCellClick(row: number, col: number) {
    if (!cells[row][col]) return;
    if (activeCell?.row === row && activeCell?.col === col) {
      const newDir = activeDirection === 'across' ? 'down' : 'across';
      const word = getWordAt(row, col, newDir);
      if (word) onWordSelect(word.number, newDir);
    } else {
      onActiveCell(row, col);
      const wordInDir = getWordAt(row, col, activeDirection);
      if (wordInDir) {
        onWordSelect(wordInDir.number, activeDirection);
      } else {
        const other: 'across' | 'down' = activeDirection === 'across' ? 'down' : 'across';
        const wordOther = getWordAt(row, col, other);
        if (wordOther) onWordSelect(wordOther.number, other);
      }
    }
    inputRef.current?.focus();
  }

  function advanceCell(row: number, col: number, dir: 'across' | 'down') {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    const nr = row + dr; const nc = col + dc;
    if (nr < size && nc < size && cells[nr]?.[nc]) onActiveCell(nr, nc);
  }

  function retreatCell(row: number, col: number, dir: 'across' | 'down') {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    const nr = row - dr; const nc = col - dc;
    if (nr >= 0 && nc >= 0 && cells[nr]?.[nc]) onActiveCell(nr, nc);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!activeCell) return;
    const { row, col } = activeCell;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (filledCells[`${row}-${col}`]) {
        onCellChange(row, col, '');
      } else {
        retreatCell(row, col, activeDirection);
      }
      return;
    }
    if (e.key === 'Delete') { e.preventDefault(); onCellChange(row, col, ''); return; }

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const wordList = words.filter(w => w.direction === activeDirection).sort((a, b) => a.number - b.number);
      const idx = wordList.findIndex(w => w.number === activeWordNumber);
      const next = wordList[(idx + 1) % wordList.length];
      if (next) { onWordSelect(next.number, next.direction); onActiveCell(next.row, next.col); }
      return;
    }

    const arrowMap: Record<string, [number, number]> = {
      ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0],
    };
    if (arrowMap[e.key]) {
      e.preventDefault();
      const [dr, dc] = arrowMap[e.key];
      const nr = row + dr; const nc = col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && cells[nr]?.[nc]) {
        onActiveCell(nr, nc);
        const newDir: 'across' | 'down' = dc !== 0 ? 'across' : 'down';
        const word = getWordAt(nr, nc, newDir) || getWordAt(nr, nc, newDir === 'across' ? 'down' : 'across');
        if (word) onWordSelect(word.number, word.direction);
      }
      return;
    }

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const letter = e.key.toUpperCase();
      onCellChange(row, col, letter);
      advanceCell(row, col, activeDirection);
    }
  }

  // Mobile keyboards often fire onChange/input events instead of keydown
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const data = (e.nativeEvent as InputEvent).data;
    if (data && /^[a-zA-Z]$/.test(data) && activeCell) {
      onCellChange(activeCell.row, activeCell.col, data.toUpperCase());
      advanceCell(activeCell.row, activeCell.col, activeDirection);
    }
    // Reset so next keystroke fires onChange again
    e.target.value = '';
  }

  return (
    // Full-width container; overflow-auto enables grid-level pan when zoomed
    <div ref={containerRef} className="w-full overflow-auto" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
      <input
        ref={inputRef}
        className="fixed"
        style={{
          top: 0, left: '-9999px',
          width: '1px', height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={handleKey}
        onChange={handleChange}
        defaultValue=""
        aria-hidden="true"
      />
      <div
        className="border-2 border-slate-800 rounded overflow-hidden shadow-md mx-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
          width: `${size * cellSize + 4}px`,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {cells.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            const key = `${rIdx}-${cIdx}`;
            const isActive = activeCell?.row === rIdx && activeCell?.col === cIdx;
            const inActiveWord = activeWordCells.has(key);
            const isCorrect = correctCells.has(key);
            const isIncorrect = incorrectCells.has(key);
            const letter = filledCells[key] || '';
            const num = cellNumberAt(rIdx, cIdx);

            if (!cell) {
              return (
                <div
                  key={key}
                  className="bg-slate-800"
                  style={{ width: cellSize, height: cellSize }}
                />
              );
            }

            return (
              <div
                key={key}
                className={clsx(
                  'crossword-cell',
                  isActive ? 'active' : inActiveWord ? 'active-word' : '',
                  isCorrect ? 'correct' : '',
                  isIncorrect && !isCorrect ? 'incorrect' : '',
                  disabled ? 'cursor-default' : ''
                )}
                style={{ width: cellSize, height: cellSize, touchAction: 'manipulation' }}
                onTouchEnd={(e) => {
                  if (disabled) return;
                  e.preventDefault(); // prevent the 300ms delay + ghost click
                  handleCellClick(rIdx, cIdx);
                  inputRef.current?.focus();
                }}
                onClick={() => !disabled && handleCellClick(rIdx, cIdx)}
              >
                {num && (
                  <span className="cell-number" style={{ fontSize: Math.max(7, cellSize / 4.5) }}>
                    {num}
                  </span>
                )}
                <span className="cell-letter" style={{ fontSize: Math.max(10, cellSize * 0.5) }}>
                  {letter}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
