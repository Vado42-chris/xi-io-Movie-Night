import { useEffect, useState } from 'react';

/* ── WHITE LABEL — the flag, and nothing else ────────────────────────────────
 *
 * One boolean the whole shell can read, held here rather than inside a surface
 * so that the knockout is a property of the estate and not of one component.
 * The chat box is the first surface to honour it; a surface that has not been
 * converted simply does not read it, which is why the guard reports coverage
 * rather than assuming it.
 *
 * It is deliberately NOT a theme. A theme picks colours; this removes them, and
 * the two must not collapse into one control — a user who wants a different
 * brand and a builder testing that there is no brand are asking opposite
 * questions of the same token set.
 *
 * Persisted, because a test you have to re-arm on every reload is a test you
 * stop running. A private-mode failure falls back to unpersisted rather than
 * throwing: the flag is a reading, not a write anyone depends on.
 */
const KEY = 'xiio.white-label';

let on = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();

const listeners = new Set();

export const isWhiteLabel = () => on;

export function setWhiteLabel(next) {
  on = !!next;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
  listeners.forEach((listener) => listener(on));
}

export function useWhiteLabel() {
  const [value, setValue] = useState(on);
  useEffect(() => {
    listeners.add(setValue);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}