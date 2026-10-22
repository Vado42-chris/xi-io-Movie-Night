/* ── THE EVENT STORE · one event, four faces ─────────────────────────────────
 *
 * The client half of the canonical event primitive. It holds the events the
 * shell has observed, fans each one out to the four projections, and records
 * which faces actually drew it.
 *
 * ── WHY THE LEDGER IS BOUNDED ───────────────────────────────────────────────
 *
 * A ledger that grows forever is a memory leak with a good reputation. The
 * ledger here is a WINDOW onto recent events, and the permanent copy — when one
 * is made — is the estate's own record. The two are different jobs and are kept
 * as different things, so a reader is never told that a 200-row array is a
 * history.
 *
 * ── ARMED IS NOT OBSERVED ───────────────────────────────────────────────────
 *
 * Every event is offered to all four faces the moment it is made, and each face
 * records for itself when it actually drew it. That distinction is the reason
 * this store keeps two sets of numbers: an event that crossed the attention
 * threshold and was never rendered is a real operational fact, and it is
 * invisible the moment the row only records that the face was available.
 *
 * ── EFFECT CEILING 0 ────────────────────────────────────────────────────────
 *
 * NOTHING HERE LEAVES THE TAB ON ITS OWN.
 *
 * The bins face is a permanent receipt, and a receipt is a filing — so filing
 * is a separate, explicit act rather than a side effect of an event happening.
 * `recordEvent` does not file; `fileEvent` does. That is the ceiling held at 0
 * in the only place it could have been quietly exceeded: an event pipeline that
 * wrote to the record every time somebody moved a window would be a filing
 * nobody vetted, made at machine speed.
 *
 * Dependency-light: it imports the primitive and, for filing only, the SDK.
 */

import { base44 } from '@/api/base44Client';
import { buildEvent, PROJECTION_IDS, ATTENTION, SCHEMA } from '@/lib/eventPrimitive.mjs';

/* How much recent history the live ledger keeps. Named rather than inlined, so
   the bound is a declared fact and not a number somebody has to find. */
export const LEDGER_LIMIT = 200;

let ledger = [];
let sessionRef = null;
let principalRef = null;

/* One listener set per projection, so a face is told about the events offered
   to it and not about the whole stream. */
const listeners = new Map(PROJECTION_IDS.map((id) => [id, new Set()]));

/* ── THE SESSION OCCURRENCE ──────────────────────────────────────────────────
 *
 * Minted once per tab and surviving routing, so events made in one sitting can
 * be read as one sitting rather than as an unordered pile that happens to share
 * a date. */
export function eventSessionRef() {
    if (sessionRef) return sessionRef;
    const KEY = 'xiio.event.session';
    try {
        const held = window.sessionStorage.getItem(KEY);
        if (held) {
            sessionRef = held;
            return sessionRef;
        }
        sessionRef = `event-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        window.sessionStorage.setItem(KEY, sessionRef);
    } catch {
        /* Storage refused — a private window, or a locked-down WebView. A
           session that cannot be remembered is still a session. */
        sessionRef = `event-session-${Date.now().toString(36)}`;
    }
    return sessionRef;
}

export function setEventPrincipal(ref) {
    principalRef = ref || null;
}

/* ── RECORD ──────────────────────────────────────────────────────────────────
 *
 * Build the event, put it in the ledger, and offer it to the four faces. It
 * does NOT file it — see the ceiling note above. */
export function recordEvent(input = {}) {
    const event = buildEvent({
        ...input,
        session_ref: input.session_ref || eventSessionRef(),
        principal_ref: input.principal_ref || principalRef,
    });

    ledger = [event, ...ledger].slice(0, LEDGER_LIMIT);

    PROJECTION_IDS.forEach((id) => {
        listeners.get(id)?.forEach((fn) => {
            try {
                fn(event);
            } catch (e) {
                /* A projection that throws must not take the event with it. The
                   event is already in the ledger; a face that could not draw it
                   is a fault in that face, and it is reported rather than
                   swallowed into the next listener's turn. */
                console.error(`[event] projection "${id}" did not draw ${event.event_ref}:`, e);
            }
        });
    });

    return event;
}

/* ── WHAT A FACE DRAWS ───────────────────────────────────────────────────────
 *
 * Called by a surface once it has actually rendered an event. It is the only
 * thing that turns an armed projection into an observed one, and nothing in
 * this store calls it on a surface's behalf — a store that marked its own
 * deliveries as observed would be marking its own homework. */
export function markProjectionObserved(eventRef, projectionId) {
    const at = new Date().toISOString();
    ledger = ledger.map((e) => (
        e.event_ref === eventRef
            ? { ...e, projections: { ...e.projections, [projectionId]: { armed: true, observed_at: at } } }
            : e
    ));
    return at;
}

/* ── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
 *
 * `widgets` and `ledger` want everything. `attention` wants only what crossed.
 * The filter lives HERE rather than in each face, so the threshold is applied
 * once and no surface can decide for itself that its own event was important. */
export function subscribeProjection(projectionId, fn) {
    const set = listeners.get(projectionId);
    if (!set) return () => {};
    set.add(fn);
    return () => set.delete(fn);
}

export function ledgerSnapshot() {
    return ledger;
}

export function attentionSnapshot() {
    return ledger.filter((e) => e.attention === ATTENTION.ATTENTION);
}

/* ── THE READING ─────────────────────────────────────────────────────────────
 *
 * What the store can say about itself. `unobserved_attention` is the number
 * that matters most and the one a summary usually drops: events that crossed
 * the threshold and no face drew. It is reported even when it is zero, because
 * a zero nobody checked and a zero that was measured look identical in a
 * summary and are not the same fact. */
export function eventStoreReading() {
    const armed = ledger.length;
    const observed = ledger.filter((e) => Object.values(e.projections || {}).some((p) => p.observed_at)).length;
    const attention = ledger.filter((e) => e.attention === ATTENTION.ATTENTION);
    return {
        schema: SCHEMA,
        held: armed,
        limit: LEDGER_LIMIT,
        observed,
        unobserved: armed - observed,
        attention: attention.length,
        unobserved_attention: attention.filter((e) => !e.projections?.attention?.observed_at).length,
        filed: ledger.filter((e) => !!e.filed_at).length,
        session_ref: eventSessionRef(),
    };
}

/* ── THE ONE FILING ──────────────────────────────────────────────────────────
 *
 * The bins face, and the only thing in this module that reaches the record.
 * Explicit, per event, and it records on the row when it was filed — so a
 * receipt can be told from an event that was merely offered one. */
export async function fileEvent(event) {
    if (!event?.event_ref) return null;
    const written = await base44.entities.Event.create({
        event_ref: event.event_ref,
        schema: event.schema,
        kind: event.kind,
        source: event.source,
        label: event.label,
        subject_ref: event.subject_ref,
        verdict: event.verdict,
        blocking: event.blocking,
        operation: event.operation,
        semantic: event.semantic,
        attention: event.attention,
        attention_why: event.attention_why,
        visibility_mode: event.visibility_mode || 'UNKNOWN',
        projections: event.projections,
        principal_ref: event.principal_ref,
        session_ref: event.session_ref,
        evidence: event.evidence,
        at: event.at,
        first_owed: event.operation?.first_owed || null,
        notes: event.notes,
    });

    const at = new Date().toISOString();
    ledger = ledger.map((e) => (e.event_ref === event.event_ref ? { ...e, filed_at: at } : e));
    return written;
}

export const NOT_CLAIMED = Object.freeze([
    'that any face is subscribed — a projection with no listener is armed and unobserved, and the reading says so',
    'that a filed event was read back — a write is not a readback',
    'that the ledger is a history — it is a bounded window, and the permanent copy is the record',
]);