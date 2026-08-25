const BASE = '/api';

// Railway's proxy strips Set-Cookie, so session auth doesn't work.
// After login we store the admin token in localStorage and append it
// as a query param so every admin request is self-authenticated.
function getAdminToken(): string | null {
  return localStorage.getItem('ww_admin_token');
}

function adminPath(path: string): string {
  const token = getAdminToken();
  if (!token) return path;
  return path + (path.includes('?') ? '&' : '?') + 'pw=' + encodeURIComponent(token);
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data as T;
}

export const api = {
  // Admin
  adminLogin: async (password: string) => {
    const data = await req<{ ok: boolean; token?: string }>('POST', '/admin/login', { password });
    if (data.token) localStorage.setItem('ww_admin_token', data.token);
    return data;
  },
  adminLogout: () => {
    localStorage.removeItem('ww_admin_token');
    return req('POST', '/admin/logout');
  },
  adminMe: () => req<{ authenticated: boolean }>('GET', adminPath('/admin/me')),
  getClues: () => req<any[]>('GET', adminPath('/admin/clues')),
  addClue: (clue: string, answer: string, hint?: string) => req('POST', adminPath('/admin/clues'), { clue, answer, hint }),
  updateClue: (id: string, clue: string, answer: string, hint?: string) => req('PUT', adminPath(`/admin/clues/${id}`), { clue, answer, hint }),
  deleteClue: (id: string) => req('DELETE', adminPath(`/admin/clues/${id}`)),
  generateCrossword: () => req('POST', adminPath('/admin/generate')),
  publishPuzzle: (data: {
    title: string; grid: unknown; startAt?: string; endAt?: string;
    timeLimitSeconds?: number; hintMode?: string;
  }) => req<{ id: string }>('POST', adminPath('/admin/puzzles'), data),
  getPuzzles: () => req<any[]>('GET', adminPath('/admin/puzzles')),
  getPuzzleStats: (id: string) => req<any>('GET', adminPath(`/admin/puzzles/${id}/stats`)),
  deletePuzzle: (id: string) => req('DELETE', adminPath(`/admin/puzzles/${id}`)),
  updatePuzzle: (id: string, data: object) => req('PUT', adminPath(`/admin/puzzles/${id}`), data),

  // Puzzles
  getActivePuzzle: () => req<any>('GET', '/puzzles/active'),
  getPuzzle: (id: string) => req<any>('GET', `/puzzles/${id}`),

  // Attempts
  startAttempt: (puzzleId: string, name: string, email: string) =>
    req<{ attemptId: string }>('POST', '/attempts', { puzzleId, name, email }),
  getAttempt: (id: string) => req<any>('GET', `/attempts/${id}`),
  checkAnswer: (attemptId: string, wordNumber: number, direction: string, answer: string) =>
    req<{ correct: boolean; word?: string }>('POST', `/attempts/${attemptId}/check`, { wordNumber, direction, answer }),
  requestHint: (attemptId: string, wordNumber: number, direction: string) =>
    req<any>('POST', `/attempts/${attemptId}/hint`, { wordNumber, direction }),
  completeAttempt: (attemptId: string, timeTakenSeconds: number) =>
    req<{ score: number; rank: number; timeTakenSeconds: number }>('POST', `/attempts/${attemptId}/complete`, { timeTakenSeconds }),
  saveProgress: (attemptId: string, progress: object) =>
    req('POST', `/attempts/${attemptId}/progress`, { progress }),
  lookupAttempt: (puzzleId: string, email: string) =>
    req<any>('GET', `/attempts/lookup?puzzleId=${puzzleId}&email=${encodeURIComponent(email)}`),

  // Leaderboard
  getLeaderboard: (puzzleId: string) => req<any[]>('GET', `/leaderboard/${puzzleId}`),
};
