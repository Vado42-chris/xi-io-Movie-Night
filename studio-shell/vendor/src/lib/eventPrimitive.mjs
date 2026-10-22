/* ── THE CANONICAL EVENT PRIMITIVE · xiio.event/v1 ───────────────────────────
 *
 * An event does not belong to the surface that happened to draw it.
 *
 * A notification bell, a dock ledger, a widget's own status line and a receipt
 * in the bins are FOUR FACES OF ONE THING, not four records that agree by hand.
 * The moment a surface owns its own copy, the copies drift — and the drift is
 * invisible from the outside, because every one of them looks plausible on its
 * own. That is the defect this module exists to make impossible: there is one
 * event, it has one address, and the surfaces read it.
 *
 * ── WHY THE REDUCTION LIVES HERE AND NOT AT THE SOURCE ──────────────────────
 *
 * A drag produces hundreds of pointer positions and ONE movement. Every surface
 * that ever drew a dragged thing has had to decide that for itself, so the
 * collapse happened somewhere different each time — in a drag handler, in a
 * store's setter, in whatever the last person to touch it thought was clean.
 *
 * It is declared ONCE here, and the raw count is kept ON the operation rather
 * than discarded. That is the whole point: a reduction you cannot audit is
 * indistinguishable from a lie. "427 ticks collapsed into one operation" is a
 * reading; "a thing moved" is a claim.
 *
 * ── EFFECT CEILING 0 ────────────────────────────────────────────────────────
 *
 * Nothing in this file transmits, files, or reaches outside the tab. It is a
 * pure reduction and a pure policy: values in, values out, no side effects. The
 * store that persists an event is a different module, and it writes to the
 * estate's own record and nowhere else.
 *
 * Dependency-free and browser-safe, so it can be exercised without a DOM.
 */

import { normalizeEventVisibility } from './eventVisibility.mjs';

export const SCHEMA = 'xiio.event/v1';

/* ── THE FOUR PROJECTIONS ────────────────────────────────────────────────────
 *
 * Declared here because the LIST is the architecture: an event drawn in a fifth
 * place is a change to this list, not a new component that happens to read the
 * store. Each one names what it is FOR, so a surface can be told which face it
 * is without anybody deciding in the moment. */
export const PROJECTIONS = Object.freeze([
    {
        id: 'widgets',
        label: 'Widgets',
        describes: 'Local operational state — what this desk is doing right now, and the status of the thing it is doing it to.',
    },
    {
        id: 'ledger',
        label: 'Right Dock',
        describes: 'The semantic ledger — what has happened, in order, in plain words. Contextual history for the surface in front of you.',
    },
    {
        id: 'attention',
        label: 'Notification Centre',
        describes: 'Attention-gated alerts. Only what crossed the threshold, because a bell that rings for everything is a bell nobody hears.',
    },
    {
        id: 'bins',
        label: 'Bins & Receipts',
        describes: 'Permanent lineage — provenance and audit trail. The event as a record that survives the tab it was made in.',
    },
]);

export const PROJECTION_IDS = Object.freeze(PROJECTIONS.map((p) => p.id));

/* ── THE TWO ATTENTION STATES ────────────────────────────────────────────────
 *
 * LEDGER is the resting state and it is NOT a failure. An ordinary state change
 * belongs in the ledger and nowhere else; promoting it to the bell is how a
 * notification surface becomes noise. */
export const ATTENTION = Object.freeze({
    LEDGER: 'LEDGER',
    ATTENTION: 'ATTENTION',
});

/* ── WHAT CROSSES THE THRESHOLD ──────────────────────────────────────────────
 *
 * A VERDICT, not a volume. An event crosses because the estate decided
 * something — refused it, blocked it, failed it, or found it owed — never
 * because it was reported loudly, and never because a surface asked to be
 * noticed. That is what keeps the threshold a policy rather than a preference.
 *
 * UNKNOWN is deliberately absent: an event whose verdict nobody read does not
 * ring the bell. A bell that rings on an unread verdict is one that rings on a
 * guess. */
export const ATTENTION_VERDICTS = Object.freeze(['BLOCKED', 'REFUSED', 'FAILED', 'OWED', 'ABSENT']);

export const VERDICTS = Object.freeze(['OK', 'BLOCKED', 'REFUSED', 'FAILED', 'OWED', 'ABSENT', 'UNKNOWN']);

export function attentionFor(event) {
    const verdict = String(event?.verdict || '').toUpperCase();
    if (ATTENTION_VERDICTS.includes(verdict)) return ATTENTION.ATTENTION;
    if (event?.blocking === true) return ATTENTION.ATTENTION;
    return ATTENTION.LEDGER;
}

/* Why it crossed, in words. Required whenever the state is ATTENTION, because
   an alert with no named reason is the same silence one layer out — and a
   reader has no way to tell it from a false alarm. */
export function attentionWhy(event) {
    const verdict = String(event?.verdict || '').toUpperCase();
    if (ATTENTION_VERDICTS.includes(verdict)) return `Verdict ${verdict}.`;
    if (event?.blocking === true) return 'The surface reported this as blocking.';
    return null;
}

/* ── RAW TELEMETRY, COLLAPSED INTO ONE ATOMIC OPERATION ──────────────────────
 *
 * `ticks` is how many raw observations were folded in. It is KEPT, not
 * consumed: the operation carries the size of the reduction it came from, so a
 * reader can see that 427 positions became one movement rather than being told
 * to trust it.
 *
 * `first` and `last` are the endpoints of the observation window. A reduction
 * that kept only the last position could not say a thing had MOVED, only where
 * it ended up — and "where it ended up" is not a movement. */
export function reduceRaw({ source, ticks, first, last, unit = 'tick' } = {}) {
    const count = Number.isFinite(ticks) ? Math.max(0, Math.floor(ticks)) : 0;

    const hasEnds = first && last
        && Number.isFinite(first.x) && Number.isFinite(first.y)
        && Number.isFinite(last.x) && Number.isFinite(last.y);

    return {
        source: source || null,
        unit,
        count,
        /* The reduction, stated as a fact about the operation. */
        collapsed: count,
        first: hasEnds ? { x: first.x, y: first.y } : null,
        last: hasEnds ? { x: last.x, y: last.y } : null,
        moved: hasEnds ? first.x !== last.x || first.y !== last.y : null,
        extent: hasEnds ? { dx: last.x - first.x, dy: last.y - first.y } : null,
        /* A reduction with no observations is not a quiet operation — it is one
           nobody watched. Named rather than rounded to zero ticks of nothing. */
        first_owed: count === 0 ? 'No raw observations were folded in.' : null,
    };
}

/* ── THE OPERATION, SAID IN WORDS ────────────────────────────────────────────
 *
 * The semantic event. It is DERIVED from the operation rather than written
 * beside it, so the sentence and the numbers can never disagree — which is the
 * only way a ledger stays worth reading. */
export function toSemantic(operation, { label } = {}) {
    if (!operation) return null;
    const who = label || operation.source || 'Something';
    const { first, last, extent, count, unit } = operation;

    if (first && last && extent) {
        if (extent.dx === 0 && extent.dy === 0) {
            return `${who} was held at X:${first.x}, Y:${first.y}.`;
        }
        return `${who} moved from X:${first.x}, Y:${first.y} → X:${last.x}, Y:${last.y}.`;
    }

    if (count === 0) return `${who} reported nothing observed.`;
    return `${who} reported ${count} ${unit}${count === 1 ? '' : 's'}.`;
}

/* ── THE CANONICAL ADDRESS ───────────────────────────────────────────────────
 *
 * Minted once, when the event is made, and never re-minted as it travels
 * between its four faces. That is the whole point of the primitive: attaching a
 * projection, gating attention and filing a receipt are all things done TO this
 * one event, and an event that was re-addressed per surface would be four
 * events wearing one name. */
export function eventAddress() {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return `xiio:event/${crypto.randomUUID()}`;
    } catch {
        /* No secure context. A weaker id is still an id, and it is better than
           an event with no address at all. */
    }
    return `xiio:event/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── ONE EVENT, ASSEMBLED ────────────────────────────────────────────────────
 *
 * The four projections are ARMED, not observed: arming says the event is
 * offered to that face, and it makes no claim that the face has drawn it.
 * `observed_at` on each projection is what a surface writes when it actually
 * renders the event — so "the bell showed it" is a reading rather than an
 * assumption, and an event that crossed the threshold and was never drawn is
 * visible as exactly that. */
export function buildEvent({
    kind = 'operation',
    source = null,
    label = null,
    subject_ref = null,
    principal_ref = null,
    session_ref = null,
    verdict = 'OK',
    blocking = false,
    ticks = 0,
    first = null,
    last = null,
    unit = 'tick',
    semantic = null,
    evidence = [],
    visibility_mode = 'UNKNOWN',
    at = null,
    notes = null,
} = {}) {
    const operation = reduceRaw({ source, ticks, first, last, unit });
    const observedAt = at || new Date().toISOString();
    const attention = attentionFor({ verdict, blocking });

    return {
        event_ref: eventAddress(),
        schema: SCHEMA,
        kind,
        source,
        label,
        subject_ref,
        principal_ref,
        session_ref,
        verdict: String(verdict || 'UNKNOWN').toUpperCase(),
        blocking: !!blocking,
        operation,
        semantic: semantic || toSemantic(operation, { label }),
        attention,
        attention_why: attention === ATTENTION.ATTENTION ? attentionWhy({ verdict, blocking }) : null,
        visibility_mode: normalizeEventVisibility(visibility_mode),
        projections: PROJECTION_IDS.reduce((acc, id) => {
            acc[id] = { armed: true, observed_at: null };
            return acc;
        }, {}),
        evidence,
        at: observedAt,
        notes,
    };
}

/* What this module does NOT claim. Stated because a primitive that arrives with
   an unqualified green is the thing the estate keeps having to unwind. */
export const NOT_CLAIMED = Object.freeze([
    'that any surface has drawn an event — each projection reports its own observed_at, and until it does the face is armed and unobserved',
    'that the raw count is the true number of hardware events — it is the number the surface folded in, and that is the only number anybody has',
    'that an event filed to the estate record has been read back — a write is not a readback',
]);