import { useEffect, useState } from 'react';
import { durableStringify } from '@/lib/durableJson';

/* ── SAVED WORKSPACES — a window state you can come back to ──────────────────
 *
 * A workspace is nothing more than the last known state of the windows: which
 * ones were open, which one had focus, and in what order they were stacked.
 * It is not a project, not a folder and not a preset — it is the desk as you
 * left it, named, so you can put it back.
 *
 * ── WHY THIS IS ITS OWN STORE AND NOT A FIELD ON SOMETHING ─────────────────
 *
 * The desktop owns its windows in component state, and a menu in the header
 * cannot reach into that without the header knowing how the desktop is built.
 * So the desktop PUBLISHES its window set here and acts on a restore request
 * that arrives back. The menu reads and writes the same two things, and neither
 * side has to know the other exists.
 *
 * The published value is a SNAPSHOT, not a live binding: a workspace saved now
 * keeps the shape the desk had at that moment, and does not silently follow the
 * desk around afterwards. That is the whole point of saving one.
 */

const KEY = 'xiio.workspaces';
const HOME_KEY = 'xiio.home-formation/v1';

/* Twelve is a working number, not a limit anyone should hit. A list long enough
   to scroll is a list nobody reads, and a workspace you cannot find is a
   workspace that was not saved. */
const MAX = 12;

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

let workspaces = read();

/* HOME is the desk as the user left it, not a named frozen snapshot.
 *
 * Named workspaces below remain explicit snapshots. HOME is different: when a
 * user pins, snaps, opens or arranges something, that current formation is the
 * default they return to after refresh/restart. A desktop that forgets where
 * the user put things is a web page, not an operating environment. */
export function readHomeFormation() {
  try {
    const raw = localStorage.getItem(HOME_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function persistHomeFormation(state) {
  try {
    localStorage.setItem(HOME_KEY, durableStringify({
      schema: 'xiio.home-formation/v1',
      saved_at: new Date().toISOString(),
      ...state,
    }));
    return true;
  } catch {
    return false;
  }
}

const listeners = new Set();
const publish = () => listeners.forEach((listener) => listener(workspaces));

const persist = () => {
  try {
    localStorage.setItem(KEY, durableStringify(workspaces));
  } catch {
    /* Private mode, or the quota is full. The list still works for this session,
       which is a real answer and is never rounded to "saved". */
  }
};

export const getWorkspaces = () => workspaces;

export function saveWorkspace(name, state) {
  const entry = {
    id: `ws_${Date.now().toString(36)}`,
    name: (name || '').trim() || 'Untitled workspace',
    saved_at: new Date().toISOString(),
    state,
  };
  workspaces = [entry, ...workspaces].slice(0, MAX);
  persist();
  publish();
  return entry;
}

export function deleteWorkspace(id) {
  workspaces = workspaces.filter((workspace) => workspace.id !== id);
  persist();
  publish();
}

export function useWorkspaces() {
  const [value, setValue] = useState(workspaces);
  useEffect(() => {
    listeners.add(setValue);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}

/* ── THE DESK, AS IT IS RIGHT NOW ───────────────────────────────────────────
 *
 * Published by the desktop, read by the menu when it captures a workspace. The
 * desktop is the only writer, because it is the only thing that knows. */
let live = { windows: [], activeWindowId: null, windowOrder: [] };

const liveListeners = new Set();

export const getLiveWindowState = () => live;

export function publishWindowState(state) {
  live = state;
  persistHomeFormation(state);
  liveListeners.forEach((listener) => listener(state));
}

export function useLiveWindowState() {
  const [value, setValue] = useState(live);
  useEffect(() => {
    liveListeners.add(setValue);
    return () => liveListeners.delete(setValue);
  }, []);
  return value;
}

/* ── PUTTING IT BACK ────────────────────────────────────────────────────────
 *
 * A restore is a REQUEST, not a value, and it carries a token so the desktop
 * can tell one restore from the next. Selecting the same workspace twice is two
 * requests; without the token the second would look identical to the first and
 * the desk would not move. */
let restore = null;

const restoreListeners = new Set();

export function requestRestore(workspace) {
  restore = { token: Date.now(), workspace };
  restoreListeners.forEach((listener) => listener(restore));
}

export function useRestoreRequest() {
  const [value, setValue] = useState(restore);
  useEffect(() => {
    restoreListeners.add(setValue);
    return () => restoreListeners.delete(setValue);
  }, []);
  return value;
}