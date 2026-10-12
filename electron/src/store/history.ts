export interface HistoryEntry<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(initial: T): HistoryEntry<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistory<T>(history: HistoryEntry<T>, next: T): HistoryEntry<T> {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

export function undoHistory<T>(history: HistoryEntry<T>): HistoryEntry<T> | null {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: HistoryEntry<T>): HistoryEntry<T> | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
