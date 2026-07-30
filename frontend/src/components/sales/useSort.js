import { useState } from 'react';

/**
 * Sort state for a list table.
 *
 * @param initialField  column to sort by on first render
 * @param initialDir    'asc' | 'desc'
 * @param firstDirs     per-column direction to use the first time it's clicked —
 *                      e.g. hottest leads or longest-neglected first, rather than
 *                      always starting ascending. Defaults to 'asc'.
 * @param onChange      called after any sort change; paginated lists use it to
 *                      jump back to page 1.
 */
export default function useSort(initialField, initialDir = 'asc', firstDirs = {}, onChange) {
  const [sortBy, setSortBy] = useState(initialField);
  const [sortDir, setSortDir] = useState(initialDir);

  const handleSort = (field) => {
    if (field === sortBy) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(firstDirs[field] || 'asc');
    }
    if (onChange) onChange();
  };

  return { sortBy, sortDir, handleSort };
}

/**
 * Client-side comparator for the lists the API returns unpaginated (zones,
 * sales reps). Paginated lists must sort on the server instead — sorting one
 * page locally would misrepresent the rest of the result set.
 */
export function sortRows(rows, sortBy, sortDir, accessors = {}) {
  const get = accessors[sortBy] || ((row) => row[sortBy]);
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (av === bv) return 0;
    if (av === null || av === undefined || av === '') return 1;   // blanks last
    if (bv === null || bv === undefined || bv === '') return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
  });
}
