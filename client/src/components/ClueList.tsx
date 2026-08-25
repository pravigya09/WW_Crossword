import { GridWord } from './CrosswordGrid';
import { clsx } from '../lib/utils';

interface Props {
  words: GridWord[];
  activeWordNumber: number;
  activeDirection: 'across' | 'down';
  completedWords: Set<string>;
  onSelect: (number: number, direction: 'across' | 'down') => void;
  hints: Record<string, string>; // key: "num-dir"
}

export function ClueList({ words, activeWordNumber, activeDirection, completedWords, onSelect, hints }: Props) {
  const across = words.filter(w => w.direction === 'across').sort((a, b) => a.number - b.number);
  const down = words.filter(w => w.direction === 'down').sort((a, b) => a.number - b.number);

  function ClueItem({ word }: { word: GridWord }) {
    const key = `${word.number}-${word.direction}`;
    const isActive = word.number === activeWordNumber && word.direction === activeDirection;
    const isDone = completedWords.has(key);
    const hint = hints[key];

    return (
      <li>
        <button
          onClick={() => onSelect(word.number, word.direction)}
          className={clsx(
            'w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-all',
            isActive ? 'bg-violet-100 text-violet-900 font-semibold' : 'hover:bg-slate-50',
            isDone ? 'text-slate-400 line-through' : 'text-slate-700'
          )}
        >
          <span className="font-bold mr-1.5 text-slate-500">{word.number}.</span>
          {word.clue}
          {hint && (
            <span className="block ml-5 text-xs text-amber-600 mt-0.5 no-underline" style={{ textDecoration: 'none' }}>
              💡 {hint}
            </span>
          )}
        </button>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">Across</h3>
        <ul className="space-y-0.5">
          {across.map(w => <ClueItem key={`${w.number}-across`} word={w} />)}
        </ul>
      </section>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">Down</h3>
        <ul className="space-y-0.5">
          {down.map(w => <ClueItem key={`${w.number}-down`} word={w} />)}
        </ul>
      </section>
    </div>
  );
}
