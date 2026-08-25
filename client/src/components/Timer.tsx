import { useEffect, useState } from 'react';
import { formatTime } from '../lib/utils';
import { copy } from '../lib/copy';

interface Props {
  timeLimitSeconds?: number | null;
  startTime: number; // Date.now()
  onExpire?: () => void;
}

export function Timer({ timeLimitSeconds, startTime, onExpire }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const e = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(e);
      if (timeLimitSeconds && e >= timeLimitSeconds) {
        clearInterval(id);
        onExpire?.();
      }
    }, 500);
    return () => clearInterval(id);
  }, [startTime, timeLimitSeconds, onExpire]);

  const remaining = timeLimitSeconds ? timeLimitSeconds - elapsed : null;
  const isUrgent = remaining !== null && remaining <= 60;

  return (
    <div className={`flex items-center gap-1.5 font-mono font-bold text-lg tabular-nums transition-colors ${isUrgent ? 'text-red-500' : 'text-slate-700'}`}>
      <span className="text-base">{remaining !== null ? '⏱' : '⏱'}</span>
      <span>{remaining !== null ? formatTime(Math.max(0, remaining)) : formatTime(elapsed)}</span>
    </div>
  );
}
