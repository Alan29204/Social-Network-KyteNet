import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'snet-search-history';
const MAX_ITEMS = 8;

/**
 * Hook quản lý lịch sử tìm kiếm gần đây (lưu localStorage).
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
          setHistory(parsed.filter((x) => typeof x === 'string'));
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  const persist = useCallback((items: string[]) => {
    setHistory(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, []);

  const addHistory = useCallback((term: string) => {
    const value = term.trim();
    if (!value) return;
    setHistory((prev) => {
      const next = [
        value,
        ...prev.filter((x) => x.toLowerCase() !== value.toLowerCase()),
      ].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const removeHistory = useCallback((term: string) => {
    setHistory((prev) => {
      const next = prev.filter((x) => x !== term);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    persist([]);
  }, [persist]);

  return { history, addHistory, removeHistory, clearHistory };
}
