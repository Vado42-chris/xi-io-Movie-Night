import { useSyncExternalStore } from 'react';
import { CHROME_LAYERS, CHROME_LAYER_IDS, chromeLayer } from '@/lib/chromeLayers.mjs';
import {
    VISIBILITY,
    ATTACHMENT,
    applyTransition,
    isValidState,
    restingState,
    restoreRequired,
} from '@/lib/compoundSurface.mjs';

/* ── THE STATE EVERY COMPOUND SURFACE READS AND WRITES ───────────────────────
 *
 * One store, because the surfaces it governs are put away and brought back from
 * several different places — the top bar hides itself, the dock hides the
 * taskbar, the conversation column hides itself, the drawer collapses and pins —
 * and local booleans cannot answer "what is away" for the one surface whose
 * whole job is to bring things back.
 *
 * ── THE MACHINE DECIDES; THIS FILE REMEMBERS ────────────────────────────────
 *
 * Every write goes through applyTransition, so the rules live in exactly one
 * place. This file holds the resulting state and nothing else: it does not know
 * what a surface is, only what the machine said a surface may become.
 *
 * ── TWO READINGS OF THE SAME STATE ──────────────────────────────────────────
 *
 *   useCompoundSurfaces()  the whole state, all three axes per surface. What a
 *                          settings panel or a placement control reads.
 *   useChromeLayers()      a derived BOOLEAN per surface — "is it on screen at
 *                          all". What a surface that only cares whether to
 *                          mount itself reads.
 *
 * The boolean is DERIVED from the full state rather than stored beside it. A
 * stored boolean and a stored visibility are two answers to one question, and
 * the two disagree the first time either is written without the other — which is
 * the drift this whole primitive exists to end.
 *
 * ── THE PREFERENCE SURVIVES THE TAB ─────────────────────────────────────────
 *
 * Putting a band away is a statement about how you want to work, and one that
 * resets on every reload is a statement nobody makes twice. A storage that
 * refuses is not a failure of the shell: the value simply does not persist and
 * everything on screen behaves identically.
 */
const KEY = 'xiio.chrome.layers';

/* Every surface rests at its declared resting state. Built from the declaration
   so a surface added there is governed the moment it lands. */
const restingFor = (layer) => ({
    ...restingState(),
    ...(layer.rests ? { visibility: layer.rests } : {}),
});

const DEFAULTS = Object.freeze(
    Object.fromEntries(CHROME_LAYERS.map((layer) => [layer.id, restingFor(layer)]))
);

/* Bumped when a surface's resting state changes. A stored value from before the
   bump is read back for every surface EXCEPT the ones that now rest away —
   otherwise the person who was already looking at them open would keep them open
   forever, and the new default would only ever reach people who had never
   opened the app. After the bump, what is stored is their own choice again. */
const STORE_VERSION = 2;

/* ── READING WHAT WAS STORED ─────────────────────────────────────────────────
 *
 * Only ids this build declares are read back, and only states the machine
 * considers valid. A stored key for a band that has since been removed is
 * ignored rather than carried, so the store can never hold state for a surface
 * nothing renders.
 *
 * A bare boolean is accepted as a legacy reading — the first cut of this store
 * wrote `true`/`false` per surface — and is mapped onto `visibility` rather than
 * discarded. A person who had already put their taskbar away should not find it
 * back because the shape of the record changed underneath them. */
function readStored() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        const next = { ...DEFAULTS };
        const current = parsed?.__v === STORE_VERSION;
        for (const id of CHROME_LAYER_IDS) {
            if (!current && chromeLayer(id)?.rests) continue;
            const value = parsed?.[id];
            if (typeof value === 'boolean') {
                next[id] = { ...restingState(), visibility: value ? VISIBILITY.VISIBLE : VISIBILITY.HIDDEN };
            } else if (isValidState(value)) {
                next[id] = { ...value };
            }
        }
        return next;
    } catch {
        return { ...DEFAULTS };
    }
}

let snapshot = readStored();
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export const getCompoundSurfaces = () => snapshot;
export const useCompoundSurfaces = () => useSyncExternalStore(subscribe, getCompoundSurfaces, getCompoundSurfaces);

export const useSurface = (id) => useCompoundSurfaces()[id] || restingState();

/* "On screen at all" — the derived reading. A collapsed surface IS on screen:
   it is its own rail, which is where its restore control lives. Only HIDDEN
   means absent. */
export const isVisible = (surfaces, id) => (surfaces?.[id]?.visibility ?? VISIBILITY.VISIBLE) !== VISIBILITY.HIDDEN;

let chromeLayersSnapshot = Object.fromEntries(
    CHROME_LAYER_IDS.map((id) => [id, isVisible(snapshot, id)])
);

export const getChromeLayers = () => chromeLayersSnapshot;

export const useChromeLayers = () => useSyncExternalStore(subscribe, getChromeLayers, getChromeLayers);

function write(next) {
    snapshot = next;
    chromeLayersSnapshot = Object.fromEntries(
        CHROME_LAYER_IDS.map((id) => [id, isVisible(snapshot, id)])
    );
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...next, __v: STORE_VERSION }));
    } catch {
        /* A shell that cannot remember a preference is still a shell. */
    }
    notify();
}

/* ── THE ONE WRITE PATH ──────────────────────────────────────────────────────
 *
 * Every caller below funnels through here, so a surface can never be put into a
 * state the machine would refuse — and a refusal is returned rather than
 * swallowed, so a control that offers something this surface does not implement
 * can say so.
 *
 * A write that changes nothing does not notify. Without that guard an effect
 * publishing a surface's state would re-notify on every render and the component
 * reading it would re-render forever. */
export function transitionSurface(id, transition) {
    const surface = chromeLayer(id);
    if (!surface) return { ok: false, first_red: 'UNKNOWN_SURFACE' };

    const current = snapshot[id] || restingState();
    const result = applyTransition(current, transition, surface.implements);
    if (!result.ok) return result;

    if (result.state.visibility === current.visibility
        && result.state.placement === current.placement
        && result.state.attachment === current.attachment) {
        return result;
    }

    write({ ...snapshot, [id]: result.state });
    return result;
}

/* Setting visibility directly, for the callers that speak in visible/away rather
   than in transitions — a prop handed up from a component that only knows
   whether its bar is on screen. It is expressed as a transition so it still
   passes through the machine. */
export function setSurfaceVisibility(id, visibility) {
    if (visibility === VISIBILITY.HIDDEN) return transitionSurface(id, 'hide');
    if (visibility === VISIBILITY.COLLAPSED) return transitionSurface(id, 'collapse');
    return transitionSurface(id, 'show');
}

/* ── THE READINGS THE REST OF THE SHELL ALREADY ASKS FOR ─────────────────────
 *
 * These keep their names from the first cut of this store so every existing
 * caller is unchanged, and they now resolve through the machine rather than
 * writing a boolean. */
export const showLayer = (id) => transitionSurface(id, 'show');
export const hideLayer = (id) => transitionSurface(id, 'hide');
export const setLayerVisible = (id, visible) =>
    setSurfaceVisibility(id, visible ? VISIBILITY.VISIBLE : VISIBILITY.HIDDEN);

/* ── THE INVARIANT, ASKED OF THE STATE ───────────────────────────────────────
 *
 * Every surface that is hidden, and therefore owes a way back. Read from the
 * machine's own rule rather than from a local comparison, so the list a recovery
 * control draws from and the rule that says a way back is owed cannot disagree.
 *
 * A surface whose `implements` does not include SHOW is a real defect and is
 * reported as one: it can be put away and has no declared way back. */
export const hiddenLayers = () =>
    CHROME_LAYER_IDS.filter((id) => restoreRequired(snapshot[id]?.visibility ?? VISIBILITY.VISIBLE));

export const unrecoverableLayers = () =>
    hiddenLayers().filter((id) => !(chromeLayer(id)?.implements || []).includes('show'));

/* A surface pinned to something. Read by whatever draws the pin, so the state of
   a pin is one field rather than a second boolean beside the machine. */
export const pinnedLayers = () =>
    CHROME_LAYER_IDS.filter((id) => snapshot[id]?.attachment === ATTACHMENT.PINNED);

/* Restore a complete HOME formation through the same declared surface state
   machine. HOME may carry the whole compound-surface snapshot, but it may not
   invent surface ids or invalid states. */
export function restoreCompoundSurfaces(saved) {
    if (!saved || typeof saved !== 'object') return { ok: false, first_red: 'NO_SAVED_SURFACES' };
    const next = { ...DEFAULTS };
    for (const id of CHROME_LAYER_IDS) {
        const value = saved[id];
        if (isValidState(value)) next[id] = { ...value };
        else if (snapshot[id] && isValidState(snapshot[id])) next[id] = { ...snapshot[id] };
    }
    write(next);
    return { ok: true, restored: CHROME_LAYER_IDS.filter((id) => isValidState(saved[id])) };
}

export const CHROME_LAYERS_DECLARED = CHROME_LAYERS;