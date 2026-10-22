import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/* ── USER SETTINGS ───────────────────────────────────────────────────────────
 *
 * The settings that belong to the PERSON, not to the estate.
 *
 * This app already had one settings surface, and it is the estate's: System
 * Config — eight tabs of intelligence, security, database and extensions, every
 * one of them a property of the machine. Nothing in the app held a property of
 * the operator.
 *
 * The cost of that gap was concrete and it landed on the file bar. The Save
 * menu ranks storage targets through `rankSaveTargets(targets, guidelines)`,
 * and `guidelines` is the user's own policy: which storage classes they prefer,
 * in what order, and from which providers. Every surface passed `{}` — because
 * there was nowhere to keep anything else. So the save menu ranked against a
 * policy nobody could state: a control wired to a value with no home.
 *
 * This is that home. One namespaced key on the User record, written through
 * `updateMe` — the same mechanism the durable prefs already use — so a choice
 * follows the person across devices instead of living in one browser.
 */
const SETTINGS_KEY = 'xi_user_settings';

export const DEFAULT_SETTINGS = {
  save_guidelines: {
    preferred_classes: ['PRIVATE', 'PROJECT', 'PUBLIC'],
    preferred_providers: [],
  },
  notifications: { email: true, system: true, reminders: true },
};

/* One read, shared.
 *
 * The file bar is drawn by every surface that has one, so this is read from
 * many places at once. A module-level cache means the User record is read once
 * per session rather than once per file bar, and the in-flight promise means
 * ten bars mounting together still make one request. */
let cache = null;
let inflight = null;
/* ── ONE READ, AND ONE ANSWER, FOR EVERY SURFACE THAT HOLDS IT ────────────────
 *
 * This was a shared read with a private write. `save` updated the module cache
 * and the CALLING hook's own state — so a second surface holding the same
 * settings (the file bar, and now the account strip that resets them) kept
 * rendering the values it had mounted with. A reset performed in one place left
 * every other place showing exactly what had just been undone.
 *
 * A cache one reader can update and another cannot see is not a shared read; it
 * is two reads that agree until somebody writes. So writers announce and every
 * holder listens — the same contract the shell's other stores already keep. */
const listeners = new Set();

async function load() {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const me = await base44.auth.me();
        const stored = me && me[SETTINGS_KEY];
        cache = {
          save_guidelines: {
            ...DEFAULT_SETTINGS.save_guidelines,
            ...(stored?.save_guidelines || {}),
          },
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(stored?.notifications || {}),
          },
        };
      } catch (e) {
        // Not signed in. The defaults are the honest answer, and nothing is
        // persisted — an unread is not a stored preference.
        cache = DEFAULT_SETTINGS;
      }
      return cache;
    })();
  }
  return inflight;
}

export function useUserSettings() {
  const [settings, setSettings] = useState(cache || DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(Boolean(cache));
  const [writeState, setWriteState] = useState(null);

  useEffect(() => {
    let mounted = true;
    load().then((next) => {
      if (mounted) {
        setSettings(next);
        setLoaded(true);
      }
    });
    const listener = (next) => { if (mounted) setSettings(next); };
    listeners.add(listener);
    return () => { mounted = false; listeners.delete(listener); };
  }, []);

  const save = useCallback(async (next) => {
    setSettings(next);
    cache = next;
    listeners.forEach((listener) => listener(next));
    try {
      await base44.auth.updateMe({ [SETTINGS_KEY]: next });
      setWriteState({ saved: true });
      /* The result is returned as well as stored, so a caller performing a
         reset can say whether the account half landed rather than assuming it. */
      return true;
    } catch (e) {
      /* The local choice is kept even when the write fails, so the surface does
         not snap back under the person's hand — but the failure is REPORTED
         rather than swallowed. A setting that looks saved and is not is the
         exact stub this hook exists to refuse. */
      setWriteState({ saved: false, first_red: e?.message || 'the write did not land' });
      return false;
    }
  }, []);

  const updateSaveGuidelines = useCallback(
    (patch) => save({ ...settings, save_guidelines: { ...settings.save_guidelines, ...patch } }),
    [settings, save]
  );

  const updateNotifications = useCallback(
    (patch) => save({ ...settings, notifications: { ...settings.notifications, ...patch } }),
    [settings, save]
  );

  /* Every account-bound preference back to its declared default, in ONE write.
   *
   * It writes the same record the individual controls write to, so a reset is
   * the same act as setting each one by hand rather than a local clearing that
   * the next read would quietly undo. */
  const reset = useCallback(() => save(DEFAULT_SETTINGS), [save]);

  return { settings, loaded, writeState, updateSaveGuidelines, updateNotifications, reset };
}

/* The read the file bar needs, without the writes. Kept as its own export so a
   surface that only wants the ranking policy does not pull the mutators in. */
export function useSaveGuidelines() {
  const { settings } = useUserSettings();
  return settings?.save_guidelines || DEFAULT_SETTINGS.save_guidelines;
}