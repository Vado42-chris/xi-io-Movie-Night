/**
 * THE TRINITY OF LINKED TRINITIES — xiio.trinity.contract/v1
 *
 * MIRROR PLACEMENT. This module exists at two physical paths because the
 * platform forbids a frontend module from importing out of base44/ and a
 * backend function from importing out of src/. The two placements are the SAME
 * module and must stay byte-identical in body. The other placement is
 * base44/shared/trinityContract.mjs.
 *
 * The owner supplied this structure as a diagram, and a diagram is a
 * declaration. It is transcribed here, not paraphrased:
 *
 *                        [TRINITY PLANE]
 *              ┌────────────────────────────────┐
 *              │ LOCAL   │  BRIDGE   │   ROOT   │
 *              └────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ TRINITY 1 (Surfaces):  ACK   │   ABI    │   AST         │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ TRINITY 2 (Stages)  :  T1s   │   T2s    │   T3s         │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Three planes, three surfaces, three stages. A cell is one of each, so the maze
 * is 27 cells and the linked trinities cross 9 times — once per surface-stage
 * pair, across all three planes. Its purpose is stated with it: to bind local
 * disk data (@node_aries_pc) with cloud projections and enforce ZERO-DRIFT
 * ONBOARDING. That is a testable claim, and `walk` is how it is tested.
 *
 * WHAT THIS CONTRACT DOES NOT DO. It declares no meaning for any mark on the
 * maze. ABI, AST, T1s, T2s and T3s appear in the diagram as positions, not as
 * definitions, and TLA governance is explicit that an undefined mark resolves to
 * UNKNOWN rather than being completed by whoever reads it next. So every mark
 * here carries `meaning: null`, and `walk` reports UNKNOWN for every cell until
 * an owner supplies a binding. An empty maze is the correct reading of an
 * undeclared maze; it is not a failure and must not be reported as one.
 *
 * ROOT IS TWO DECLARED THINGS. The trinity plane names a ROOT, and the PNEUMA
 * coordinate chain names a ROOT as its first anchor. The chain's rails are
 * declared in pneumaContract's ANCHOR_ORDER and spelled THERE and nowhere else —
 * this module NAMES the collision, it does not carry a second copy of the frame
 * that would let the two spellings drift apart. Nothing in this repository states
 * that they are the same ROOT, and nothing states that they are different. That
 * is recorded below as a collision with its binding NOT_ESTABLISHED, rather than
 * silently unified or silently ignored.
 */

export const TRINITY = Object.freeze({
  schema: 'xiio.trinity.contract/v1',
  generation: 1,
  owner: 'xi-io:owner',
  plane: Object.freeze(['LOCAL', 'BRIDGE', 'ROOT']),
  surfaces: Object.freeze(['ACK', 'ABI', 'AST']),
  stages: Object.freeze(['T1s', 'T2s', 'T3s']),
  purpose: 'bind local disk data with cloud projections and enforce zero-drift onboarding',
  bound_subject_example: '@node_aries_pc',
});

/* ── THE MARKS ON THE MAZE ──────────────────────────────────────────────── */

/**
 * Every mark the diagram places, with the position it holds and no meaning. The
 * three planes are listed as marks too, because they are named on the maze and a
 * name on the maze is a mark.
 */
export const TRINITY_MARKS = Object.freeze([
  { literal: 'LOCAL', kind: 'plane', index: 0, meaning: null },
  { literal: 'BRIDGE', kind: 'plane', index: 1, meaning: null },
  { literal: 'ROOT', kind: 'plane', index: 2, meaning: null },
  { literal: 'ACK', kind: 'surface', index: 0, meaning: null },
  { literal: 'ABI', kind: 'surface', index: 1, meaning: null },
  { literal: 'AST', kind: 'surface', index: 2, meaning: null },
  { literal: 'T1s', kind: 'stage', index: 0, meaning: null },
  { literal: 'T2s', kind: 'stage', index: 1, meaning: null },
  { literal: 'T3s', kind: 'stage', index: 2, meaning: null },
]);

const BY_LITERAL = Object.fromEntries(TRINITY_MARKS.map((m) => [m.literal, m]));

/** The mark as declared, or null. Never a completed meaning. */
export const findMark = (literal) => BY_LITERAL[String(literal || '').toUpperCase()] || null;

/* ── THE TWO CROSSINGS THAT ARE NOT THIS ONE ────────────────────────────── */

/**
 * Three planes are crossed by src/components/framework/semanticCrossing.js, and
 * they are local | registry | cloud. Three planes are declared on this contract,
 * and they are LOCAL | BRIDGE | ROOT. Both triples are real; the relationship
 * between them is not established anywhere in this repository.
 *
 * It is not asserted here that registry is BRIDGE, or that cloud is ROOT, because
 * a guess written into canonical truth is worse than a marked absence. It is also
 * not deleted, because three planes really are being crossed there and a crossing
 * that loses its plane names loses the thing it was checking.
 */
export const CROSSING_PLANES = Object.freeze({
  declared: Object.freeze(['local', 'registry', 'cloud']),
  owner: 'src/components/framework/semanticCrossing.js',
  binding_to_trinity: 'NOT_ESTABLISHED',
  note: 'three planes are crossed there and three are declared here; nothing states they are the same three',
});

/** Same word, two declared things. Recorded, not resolved. */
export const ROOT_COLLISION = Object.freeze({
  word: 'ROOT',
  in_trinity: 'the third plane of the trinity',
  in_pneuma: 'the first anchor of the coordinate chain (pneumaContract ANCHOR_ORDER)',
  binding: 'NOT_ESTABLISHED',
});

/* ── THE MAZE ───────────────────────────────────────────────────────────── */

const COORDINATE_SEPARATOR = '.';

/** Every cell, in plane-major order: 3 x 3 x 3 = 27. */
export function cells() {
  const out = [];
  for (const plane of TRINITY.plane) {
    for (const surface of TRINITY.surfaces) {
      for (const stage of TRINITY.stages) {
        out.push({
          coordinate: [plane, surface, stage].join(COORDINATE_SEPARATOR),
          plane,
          surface,
          stage,
        });
      }
    }
  }
  return out;
}

/** The nine linked trinities: one per surface-stage pair, each crossing 3 planes. */
export function crossings() {
  const out = [];
  for (const surface of TRINITY.surfaces) {
    for (const stage of TRINITY.stages) {
      out.push({
        crossing: [surface, stage].join(COORDINATE_SEPARATOR),
        surface,
        stage,
        cells: TRINITY.plane.map((plane) => [plane, surface, stage].join(COORDINATE_SEPARATOR)),
      });
    }
  }
  return out;
}

/* ── THE WALK ───────────────────────────────────────────────────────────── */

const isRead = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Read one cell against a registry. The registry is a plain map of coordinate to
 * binding; a coordinate absent from it is UNKNOWN, and an absent binding is the
 * assertion that no owner has supplied one — never that the value is empty.
 */
export function resolveCell(cell, registry = {}) {
  const entry = registry[cell.coordinate];
  if (!entry || !isRead(entry.meaning)) {
    return {
      ...cell,
      state: 'UNKNOWN',
      meaning: 'UNKNOWN',
      owner_ref: entry?.owner_ref || null,
      source: 'no owner has supplied a binding for this coordinate',
    };
  }
  return {
    ...cell,
    state: 'BOUND',
    meaning: entry.meaning,
    owner_ref: entry.owner_ref || null,
    generation: entry.generation ?? null,
    source: entry.owner_ref || 'registry',
  };
}

/**
 * Walk the whole maze for one subject.
 *
 * Each crossing compares its three planes. All three UNKNOWN is UNKNOWN — not
 * QUALIFIED, because nothing was read. Three read values that agree are
 * QUALIFIED. Any disagreement is CONTESTED, and CONTESTED is never resolved in
 * favour of whichever plane happened to be read first.
 *
 * `onboardable` is the zero-drift claim, and it is false unless every one of the
 * nine crossings qualified. FAIL or UNKNOWN blocks promotion; a partial
 * denominator may never promote.
 */
export function walk(subject, registry = {}) {
  const allCells = cells().map((c) => resolveCell(c, registry));
  const byCoordinate = Object.fromEntries(allCells.map((c) => [c.coordinate, c]));

  const allCrossings = crossings().map((crossing) => {
    const read = TRINITY.plane.map((plane) => byCoordinate[crossing.cells[TRINITY.plane.indexOf(plane)]]);
    const known = read.filter((c) => c.state === 'BOUND');
    const readMap = Object.fromEntries(
      read.map((c) => [c.plane, c.state === 'BOUND' ? c.meaning : null]),
    );

    /* A crossing compares THREE planes, so it may only qualify when all three
       were read.
     *
       It used to qualify on whichever planes happened to be bound — the only
       thing that stopped it was `known.length === 0`. So one binding out of
       three returned QUALIFIED while the other two planes sat at null, and nine
       bindings spread one per crossing promoted a subject with eighteen of the
       twenty-seven cells unread. The partial denominator this contract's own
       rule forbids promoting was arriving through the comparison rather than
       through the count, where the rule was written.

       `unread_planes` names what is missing, so a blocked crossing says which
       plane it is waiting on instead of only that it is waiting. */
    if (known.length < TRINITY.plane.length) {
      return {
        ...crossing,
        state: 'UNKNOWN',
        read: readMap,
        dissenting: [],
        unread_planes: read.filter((c) => c.state !== 'BOUND').map((c) => c.plane),
      };
    }

    const first = known[0].meaning;
    const dissenting = known.filter((c) => c.meaning !== first).map((c) => c.plane);

    return {
      ...crossing,
      state: dissenting.length === 0 ? 'QUALIFIED' : 'CONTESTED',
      read: readMap,
      dissenting,
    };
  });

  const unbound = allCells.filter((c) => c.state === 'UNKNOWN').map((c) => c.coordinate);
  const contested = allCrossings.filter((c) => c.state === 'CONTESTED').map((c) => c.crossing);
  const unknown = allCrossings.filter((c) => c.state === 'UNKNOWN').map((c) => c.crossing);

  return {
    schema: TRINITY.schema,
    subject,
    digest: trinityDigest(),
    denominator: { cells: allCells.length, crossings: allCrossings.length },
    cells: allCells,
    crossings: allCrossings,
    unbound,
    contested,
    unknown,
    onboardable: contested.length === 0 && unknown.length === 0,
    blocked_by: [...contested, ...unknown],
    rule: 'FAIL_OR_UNKNOWN_BLOCKS_PROMOTION',
  };
}

/* ── DIGEST ─────────────────────────────────────────────────────────────── */

/** FNV-1a over the declared structure. Covers the maze, not the bindings. */
export function trinityDigest() {
  const body = JSON.stringify({ TRINITY, TRINITY_MARKS, CROSSING_PLANES, ROOT_COLLISION });
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i += 1) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, '0')}`;
}