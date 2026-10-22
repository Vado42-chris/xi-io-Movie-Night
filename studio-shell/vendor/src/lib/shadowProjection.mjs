/**
 * THE SHADOW PROJECTION — xiio.shadow/v1
 *
 * 1s–5s are the ladder's operator row: five verbs, declared in pneumaContract
 * and READ from there. Nothing here restates what a rung is.
 *
 * 6–10 are NOT a second row of verbs. The ladder ends at 5s and says so, and
 * inventing five more rungs to fill the gap would be the exact move this estate
 * keeps paying for — a plausible shape standing where a fact should be.
 *
 * What 6–10 actually are is the SHADOW: the five verbs projected across the ring
 * the frame already declares. The ring is ten wide (LOOP_RING), so every
 * position has a mirror, and the mirror of 1s is 6s while the mirror of 5s is
 * 10s. That last one is checkable rather than poetic — 10s is a real rung, the
 * first of the decade row, and the shadow of the top operator verb lands on it.
 * The two rows meet there and nowhere else.
 *
 * The other end is the reset. On a ring of ten, 10 IS 0 — so "a 1 becomes a 0
 * again and resets the stacks" is arithmetic here and not a figure of speech.
 *
 * And the pivot: from 5s the reset is FIVE STEPS EITHER WAY. Five forward lands
 * on 10; five back lands on 0; the two are the same position. That is why the
 * ladder calls 5s a bounded cube pivot, and it is derived below rather than
 * asserted, so a reader can disagree with the arithmetic instead of the prose.
 */

import { SCALE_LADDER, LOOP_RING } from '@/lib/pneumaContract.mjs';

export const SHADOW_SCHEMA = 'xiio.shadow/v1';

/** The ring both the tick and the cycle run on. Read from the contract. */
export const RING = LOOP_RING;

/* ── THE RING ───────────────────────────────────────────────────────────── */

/** Ring position of a rung: 1..10. Out-of-range input wraps rather than failing. */
export function ring(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return ((v - 1) % RING + RING) % RING + 1;
}

/** The mirror across the ring of ten. 1↔6, 2↔7, 3↔8, 4↔9, 5↔10. An involution. */
export function shadowOf(n) {
  const r = ring(n);
  return r == null ? null : ring(r + RING / 2);
}

/** The reset. 10 becomes 0 — the position where the stacks return to zero. */
export function resetOf(n) {
  const r = ring(n);
  return r == null ? null : r % RING;
}

/**
 * What a position IS, read from the ladder rather than declared here.
 *
 * Three outcomes and they are never collapsed: a real rung (with its row), the
 * reset, or a shadow position — a place on the ring that no row claims. A
 * shadow that reported itself as a rung would be a rung nobody declared.
 */
export function positionAt(n) {
  const v = Math.round(Number(n));
  if (v === 0) {
    return { n: 0, label: '0', note: 'the reset — the stacks return to zero', row: 'ring', established: true };
  }
  const rung = SCALE_LADDER.find((r) => r.n === v);
  if (rung) {
    return { n: v, label: rung.label, note: rung.note, row: rung.axis, established: true };
  }
  const shadow = shadowOf(v);
  return {
    n: v,
    label: `${v}s`,
    note: `a shadow position — not a rung of either row; it is ${shadow}s projected`,
    row: 'shadow',
    established: false,
  };
}

/**
 * The shadow of every operator rung, in order.
 *
 * `meets` marks the one position where the shadow lands on a declared rung. It
 * is computed, not chosen: 5s shadows 10s, and 10s is the decade row's own first
 * entry. A surface that drew the shadow without saying which of its positions is
 * real would be drawing a row of five equals.
 */
export function projectShadow() {
  return [1, 2, 3, 4, 5].map((n) => {
    const at = shadowOf(n);
    const position = positionAt(at);
    return {
      from: n,
      from_label: positionAt(n).label,
      at,
      at_label: position.label,
      at_note: position.note,
      meets_declared_rung: position.established && position.row !== 'ring',
      row: position.row,
    };
  });
}

/**
 * The pivot property, derived.
 *
 * The reset is the same distance in both directions from the top operator rung.
 * `same_reset` is the check, not a claim about it: five forward lands on 10,
 * five back lands on 0, and the reset of 10 is 0 — so the two ends agree.
 */
export function pivotProperty(at = 5) {
  const a = ring(at);
  const forward = ring(a + RING / 2);
  const backwardRaw = a - RING / 2;
  const backward = backwardRaw <= 0 ? 0 : backwardRaw;
  return {
    at: a,
    forward,
    backward,
    forward_reset: resetOf(forward),
    backward_reset: backward,
    same_reset: resetOf(forward) === backward,
    equidistant: true,
  };
}

/* ── THE GATE ───────────────────────────────────────────────────────────── */

export const GATE_DIRECTION = Object.freeze({ FUTURE: 'future', PAST: 'past' });

/**
 * A gate is placed AT 5s and fires somewhere else on the ring.
 *
 * That is the whole of it: you are standing at the pivot, and you can put a gate
 * up ahead of you or behind you, and it detonates when the loop reaches that
 * position. The far end of either direction is the reset — five steps forward is
 * 10 and five back is 0, and 10 ≡ 0 — so a gate placed at the pivot has the same
 * destination whichever way it faces.
 *
 * A gate that has not been reached has not fired, and `fired` is not a field
 * here for that reason: this is the placement, and a placement is not an
 * occurrence.
 *
 * `headless` is the subterranean flag. A gate that runs headless does not
 * interrupt the principal — it is exactly the work that should not be brought to
 * the surface for approval, because the user's experience of the app is not a
 * queue the estate gets to join.
 */
export function placeGate({
  at = 5,
  direction = GATE_DIRECTION.FUTURE,
  offset = 1,
  condition = null,
  rule_ref = null,
  headless = true,
  label = null,
} = {}) {
  const a = ring(at);
  const o = Math.max(1, Math.min(RING / 2, Math.round(Number(offset)) || 1));
  const fires_at = direction === GATE_DIRECTION.PAST ? Math.max(0, a - o) : ring(a + o);
  const position = positionAt(fires_at);

  return {
    at: a,
    direction,
    offset: o,
    fires_at,
    fires_at_label: position.label,
    fires_at_note: position.note,
    lands_on_declared_rung: position.established && position.row !== 'ring',
    reset: fires_at === 0 || fires_at === RING,
    reset_value: resetOf(fires_at === 0 ? RING : fires_at),
    condition,
    rule_ref,
    headless,
    /* A subterranean gate is headless by definition — the two are one fact, and
       carrying them as two flags would let a gate be subterranean and
       interrupting at once, which is the thing the owner said not to do. */
    interrupts: !headless,
    label: label ?? `${direction} ${o} from ${a}s → ${fires_at}s`,
  };
}

/* ── THE UNIVERSAL TOOL CHEST ───────────────────────────────────────────── */

/**
 * A valuable reusable tool becomes mapped to the meta tags, so reaching it again
 * is a query rather than a hunt — "search to create search", one level up.
 *
 * Every entry names a real tool this estate already has. The tags are the whole
 * index: a tool with no tags is a tool nothing can find, so each one declares
 * what it is for in the same words a search would use.
 *
 * `headless` is the binary split. A tool that can run without the principal is
 * one a 1s can be broken down into at any level for transport, which is the
 * whole point of breaking it down: subterranean work does not interrupt the
 * surface.
 */
export const TOOL_CHEST = Object.freeze([
  { ref: 'search', kind: 'function', headless: true, tags: ['search', 'index', 'reusable', 'read'] },
  { ref: 'hotFolder', kind: 'function', headless: true, tags: ['trigger', 'folder', 'detonate', 'automation'] },
  { ref: 'detonate', kind: 'function', headless: false, tags: ['detonate', 'blast-radius', 'change'] },
  { ref: 'detonateCone', kind: 'function', headless: false, tags: ['detonate', 'blast-radius', 'cone'] },
  { ref: 'repoCensus', kind: 'function', headless: true, tags: ['census', 'read', 'repo', 'reusable'] },
  { ref: 'featureCensus', kind: 'function', headless: true, tags: ['census', 'read', 'feature', 'reusable'] },
  { ref: 'pneumaLoop', kind: 'function', headless: true, tags: ['loop', 'cadence', 'automation'] },
  { ref: 'glassbox', kind: 'function', headless: true, tags: ['readback', 'route', 'receipt'] },
  { ref: 'capabilityRoute', kind: 'function', headless: true, tags: ['route', 'capability', 'dispatch'] },
  { ref: 'nightShift', kind: 'function', headless: true, tags: ['shift', 'crew', 'automation'] },
  { ref: 'measure', kind: 'function', headless: true, tags: ['measure', 'read', 'reusable'] },
]);

/**
 * The simple query. Exact tag match, case-insensitive — a tag is a name, not a
 * pattern, and a query that fuzzy-matched would return the chest back for any
 * input, which is the same as having no index.
 */
export function reusableByTag(chest, tag) {
  const t = String(tag || '').trim().toLowerCase();
  if (!t) return [];
  return chest.filter((tool) => (tool.tags || []).some((x) => String(x).toLowerCase() === t));
}

/** Every tag in the chest, deduplicated — what a query can actually be made of. */
export function chestTags(chest) {
  const seen = new Set();
  for (const tool of chest) for (const t of tool.tags || []) seen.add(t);
  return [...seen].sort();
}

/** The chest split by whether a tool can run without the principal. */
export function chestSplit(chest) {
  return {
    subterranean: chest.filter((t) => t.headless),
    surfaced: chest.filter((t) => !t.headless),
  };
}

/* ── THE BINDING ────────────────────────────────────────────────────────── */

/**
 * A gate bound to a rule, and whether the binding is real.
 *
 * The rule ref is checked against the rules that actually exist rather than
 * believed. A gate pointing at a rule nobody declared is UNBOUND, and saying so
 * is the point — a hot folder that "detonates at the correct time" against a
 * rule that does not exist detonates never.
 */
export function bindGate(gate, rules = []) {
  if (!gate?.rule_ref) {
    return { gate, binding: 'STANDALONE', rule: null, why: 'the gate names no rule and fires on its own position' };
  }
  const rule = rules.find((r) => r.rule_ref === gate.rule_ref) || null;
  if (!rule) {
    return { gate, binding: 'UNBOUND', rule: null, why: `no rule declares ${gate.rule_ref}` };
  }
  return {
    gate,
    binding: rule.enabled ? 'BOUND_AND_RUNNING' : 'BOUND_NOT_RUNNING',
    rule,
    why: rule.enabled
      ? `${gate.rule_ref} is enabled and detonates at ${gate.fires_at_label}`
      : `${gate.rule_ref} is declared but not enabled — a declared rule is not a running one`,
  };
}