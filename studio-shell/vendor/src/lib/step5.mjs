/**
 * THE STEP-5 ENVELOPE — xiio.step5/v1
 *
 * MIRROR PLACEMENT. This module exists at two physical paths because the
 * platform forbids a frontend module from importing out of base44/ and a
 * backend function from importing out of src/. The two placements are the SAME
 * module and must stay byte-identical in body. The other placement is
 * base44/shared/step5.mjs.
 *
 * A worker that enters the maze without a qualified address starts rebuilding
 * the maze itself. That is the whole of the @ibal problem, and it is not a model
 * being weak — it is a worker being handed a question with no coordinate:
 *
 *   README?  or boundary?  or information?  or tool?   -> asks Chris
 *
 * So every worker turn carries an address BEFORE inference, and the envelope is
 * that address:
 *
 *   YOU ARE HERE  [PLANE][SURFACE][STAGE]
 *   ROOT          qualified | contested | unknown
 *   FLOOR
 *   CEILING
 *   COMPASS
 *   PAYLOAD
 *   TIME
 *   BILLING
 *   DELIVERED
 *   RETURN        [next coordinate]
 *   RESUME        [original work]
 *
 * THE FORMATION IS BOUNDED. A worker should not receive the entire maze. If it
 * occupies [BRIDGE][ABI][T2s], the compiler emits the minimum formation for that
 * coordinate plus its adjacent crossings and relevant hostiles. Global knowledge
 * lives in the registry; the worker gets a projection.
 *
 * NOTHING HERE IS INVENTED. A field with no owner-supplied value is UNKNOWN and
 * is emitted as UNKNOWN. A field that is absent is not the same as a field that
 * is empty, and neither is a value.
 */

import { TRINITY, cells, crossings, resolveCell } from '@/components/framework/trinityContract';

export const STEP5_SCHEMA = 'xiio.step5/v1';

export const FIELDS = Object.freeze([
  'YOU_ARE_HERE', 'ROOT', 'BASE', 'HOME', 'FLOOR', 'CEILING', 'COMPASS', 'PAYLOAD',
  'TIME', 'BILLING', 'DELIVERED', 'RETURN', 'RESUME',
]);

/** The step a worker starts at when it has no address. */
export const STEP1 = 'STEP1';

const isRead = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Parse a coordinate. Three parts or it is not an address.
 *
 * Matched against the declared axes case-insensitively, but returned in the
 * DECLARED casing. Uppercasing the input first is wrong here: the stage axis is
 * declared T1s, T2s, T3s with a lowercase s, so uppercasing turns a valid address
 * into one that matches nothing — and an address that silently fails to parse is
 * exactly the failure this envelope exists to prevent.
 */
export function parseCoordinate(coordinate) {
  const parts = String(coordinate || '').split('.');
  if (parts.length !== 3) return null;
  const match = (axis, value) => axis.find((a) => a.toLowerCase() === String(value).toLowerCase());
  const plane = match(TRINITY.plane, parts[0]);
  const surface = match(TRINITY.surfaces, parts[1]);
  const stage = match(TRINITY.stages, parts[2]);
  if (!plane || !surface || !stage) return null;
  return { coordinate: [plane, surface, stage].join('.'), plane, surface, stage };
}

/**
 * Compile the minimum formation for one coordinate.
 *
 * Adjacency is deterministic: the two cells sharing this cell's surface and
 * stage, plus the two other stages of this cell's surface and plane. Everything
 * else in the maze is deliberately left out — a worker handed all 27 cells is a
 * worker handed the maze instead of a coordinate.
 */
export function adjacentCoordinates(coordinate) {
  const parsed = parseCoordinate(coordinate);
  if (!parsed) return [];
  const { plane, surface, stage } = parsed;

  const adjacent = new Set();
  for (const p of TRINITY.plane) if (p !== plane) adjacent.add([p, surface, stage].join('.'));
  for (const s of TRINITY.surfaces) if (s !== surface) adjacent.add([plane, s, stage].join('.'));
  for (const t of TRINITY.stages) if (t !== stage) adjacent.add([plane, surface, t].join('.'));
  return [...adjacent];
}

/**
 * Compile the envelope. `state` carries whatever the caller actually observed —
 * a root, a ceiling, a payload, a return coordinate. Anything it does not carry
 * is UNKNOWN, and the envelope says so rather than leaving a blank to be filled
 * in by whoever reads it next.
 */
export function compileEnvelope({ coordinate, subject, state = {}, registry = {} } = {}) {
  const parsed = parseCoordinate(coordinate);
  const cell = parsed ? cells().find((c) => c.coordinate === parsed.coordinate) : null;
  const resolved = cell ? resolveCell(cell, registry) : null;

  const field = (value) => (isRead(value) ? value : 'UNKNOWN');

  /* ── THE RAILS ──────────────────────────────────────────────────────────
   * ROOT, BASE and HOME are rails, not cells. The registry is keyed by
   * coordinate and a rail has none, so these three were read from the caller's
   * `state` alone — and a worker whose caller supplied nothing reported UNKNOWN
   * for all three no matter what the estate had declared. A02H ("can identify
   * HOME") could therefore never pass: not because HOME was missing, but
   * because no code ever looked.
   *
   * They are read from the registry now, under the rail's own name, and a
   * caller-supplied value still wins. Nothing is invented: a rail nobody has
   * bound is still UNKNOWN, so A02H still refuses an undeclared HOME. What
   * changed is that a DECLARED rail can be seen rather than only told.
   */
  const rail = (name, supplied) => {
    if (isRead(supplied)) return supplied;
    const bound = registry?.[name];
    if (!bound) return null;
    return bound.meaning ?? bound.owner_ref ?? null;
  };

  return {
    schema: STEP5_SCHEMA,
    step: parsed ? 'STEP5' : STEP1,
    subject: subject ?? 'UNKNOWN',
    you_are_here: parsed ? parsed.coordinate : 'UNKNOWN',
    address: parsed,
    root: field(rail('ROOT', state.root)),
    base: field(rail('BASE', state.base)),
    home: field(rail('HOME', state.home)),
    floor: field(state.floor),
    ceiling: field(state.ceiling),
    compass: field(state.compass),
    payload: field(state.payload),
    time: field(state.time),
    billing: field(state.billing),
    delivered: field(state.delivered),
    return_to: field(state.return_to),
    resume: field(state.resume),
    binding: resolved ? resolved.state : 'UNKNOWN',
    formation: parsed
      ? {
          coordinate: parsed.coordinate,
          adjacent: adjacentCoordinates(parsed.coordinate),
          crossings: crossings().filter((c) => c.surface === parsed.surface && c.stage === parsed.stage).map((c) => c.crossing),
          hostiles: ['FORWARD_WITHOUT_INVERSE', 'HOSTILE_SKIPPED', 'UNKNOWN_PROMOTED', 'GENERATION_LOST', 'ADDRESS_LOST'],
          bounded: true,
          note: 'the minimum formation for this coordinate, not the whole maze',
        }
      : null,
  };
}

/* ── THE FRESH-WORKER ACCEPTANCE ────────────────────────────────────────── */

/**
 * Ten lines. Eight are the envelope answering for itself; two are the failures
 * that mean it did not have an address at all.
 *
 *   asks Chris for known state   FAIL
 *   starts at Step 1             FAIL
 *
 * Each line is PASS, FAIL or UNKNOWN. UNKNOWN is kept as its own state because
 * FAIL_OR_UNKNOWN_BLOCKS_PROMOTION — collapsing it into FAIL would hide the
 * difference between "we checked and it was wrong" and "we had nothing to check".
 */
export function acceptFreshWorker(envelope) {
  const line = (id, question, value) => {
    const read = isRead(value) && value !== 'UNKNOWN';
    return { id, question, state: read ? 'PASS' : 'UNKNOWN', value: value ?? 'UNKNOWN' };
  };

  const lines = [
    line('A01', 'can locate itself', envelope?.you_are_here),
    line('A02', 'can identify ROOT', envelope?.root),
    line('A02B', 'can identify BASE', envelope?.base),
    line('A02H', 'can identify HOME', envelope?.home),
    line('A03', 'can identify floor', envelope?.floor),
    line('A04', 'can identify ceiling', envelope?.ceiling),
    line('A05', 'can identify COMPASS', envelope?.compass),
    line('A06', 'can identify PAYLOAD', envelope?.payload),
    line('A07', 'can identify RETURN', envelope?.return_to),
    line('A08', 'can identify RESUME', envelope?.resume),
    {
      id: 'A09',
      question: 'asks Chris for known state',
      state: envelope?.step === STEP1 ? 'FAIL' : 'PASS',
      value: envelope?.step === STEP1 ? 'the worker has no address' : 'the worker did not ask',
    },
    {
      id: 'A10',
      question: 'starts at Step 1',
      state: envelope?.step === STEP1 ? 'FAIL' : 'PASS',
      value: envelope?.step ?? 'UNKNOWN',
    },
  ];

  const failed = lines.filter((l) => l.state === 'FAIL');
  const unknown = lines.filter((l) => l.state === 'UNKNOWN');

  return {
    subject: envelope?.subject ?? 'UNKNOWN',
    you_are_here: envelope?.you_are_here ?? 'UNKNOWN',
    lines,
    accepted: failed.length === 0 && unknown.length === 0,
    failed: failed.map((l) => l.id),
    unknown: unknown.map((l) => l.id),
    rule: 'FAIL_OR_UNKNOWN_BLOCKS_PROMOTION',
  };
}

/* ── THE CHANGE PATH ────────────────────────────────────────────────────── */

/**
 * A change lands at a coordinate and advances a generation. Affectedness is which
 * coordinates depend on it, and it is computed rather than guessed:
 *
 *   CHANGE -> coordinate diff -> affected coordinates -> detonator
 *          -> invalidate affected formations -> compile new packets -> workers continue
 *
 * No global cold restart, and no re-onboarding everybody for one changed cell.
 */
export function affectedCoordinates(changedCoordinate, previousGeneration, nextGeneration) {
  const parsed = parseCoordinate(changedCoordinate);
  if (!parsed) return { changed: null, affected: [], previous_generation: previousGeneration, next_generation: nextGeneration };

  const affected = [parsed.coordinate, ...adjacentCoordinates(parsed.coordinate)];

  return {
    changed: parsed.coordinate,
    previous_generation: previousGeneration,
    next_generation: nextGeneration,
    generation_advanced: previousGeneration !== nextGeneration,
    affected,
    unaffected: cells().map((c) => c.coordinate).filter((c) => !affected.includes(c)),
    rule: 'only affected coordinates detonate and rehydrate',
  };
}