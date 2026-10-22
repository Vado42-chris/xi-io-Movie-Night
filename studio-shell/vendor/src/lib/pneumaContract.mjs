/**
 * THE CANONICAL PNEUMA CONTRACT — xiio.pneuma.contract/v1
 *
 * One owner for every value the PNEUMA frame carries. Consumers READ this
 * module; none of them re-declare a coordinate, a tier, a rung, a hostile or a
 * promotion rule. A consumer holding its own copy of a canonical value is the
 * defect this file exists to make impossible.
 *
 * PLACEMENT NOTE — this contract exists at two physical paths because the
 * platform forbids a frontend module from importing out of base44/ and a
 * backend function from importing out of src/. The two placements are the SAME
 * contract, and integration hostile M compares their canonicalDigest() — if
 * they diverge by a single byte, the hostile FAILS. A mirror that is policed is
 * not a second source of truth; an unpoliced one would be.
 *
 * CORRECTED 2026-09-28 — the placement note above claims the hostile fails if
 * the two placements "diverge by a single byte". That is not what is enforced,
 * and the claim was measurably false: the placements diverge by 134 bytes,
 * because this placement declares BACKEND_PLACEMENT and the backend one cannot
 * (it would be naming itself), and hostile M PASSES. The rule and the
 * enforcement disagreed, and the RULE was the part that was wrong —
 * canonicalDigest() covers the values the contract DECLARES, and a placement's
 * own path is not one of those values. The enforced rule is stated here now
 * instead of a stronger one nobody runs: a claim may not outrun its readback.
 *
 * COMDCCT is NOT unknown. Its semantics are established in the existing
 * architecture — src/components/framework/registry.jsx declares the anchor
 * order ['ROOT','BASE','HOME','COMDCCT'] and describes COMDCCT as the Command
 * anchor: "Where you run and control it". Every control surface (Console,
 * Emergency, Settings, Audit, AcsKernel, Census, ...) hangs from that rail.
 *
 * Tier spelling is SIVER, not SILVER. The owner-supplied frame spells it that
 * way, and a frame that has been quietly tidied up is a different frame.
 */

export const CONTRACT = 'xiio.pneuma.contract/v1';
export const GENERATION = 2;
export const LINEAGE = 'xiio:pneuma:canonical';

/* ── THE FOUR RAILS ─────────────────────────────────────────────────────── */

export const ANCHOR_ORDER = Object.freeze(['ROOT', 'BASE', 'HOME', 'COMDCCT']);

export const ANCHORS = Object.freeze({
  ROOT: { short: 'ROOT', label: 'Root', blurb: 'The business itself', semantics: 'ESTABLISHED' },
  BASE: { short: 'BASE', label: 'Base', blurb: 'Where you plan and connect', semantics: 'ESTABLISHED' },
  HOME: { short: 'HOME', label: 'Home', blurb: 'Where you build and live', semantics: 'ESTABLISHED' },
  COMDCCT: {
    short: 'COMDCCT',
    label: 'Command',
    blurb: 'Where you run and control it',
    semantics: 'ESTABLISHED',
    semantics_source: 'src/components/framework/registry.jsx',
    role: 'control rail — every command and control surface hangs from it',
  },
});

/** The operating frame, verbatim. @ibal addresses this. */
export const FRAME = '[ROOT][BASE][HOME][COMDCCT]';

/**
 * The coordinate chain is bidirectional: a coordinate is legible from either
 * end, and a chain that only reads one way cannot be walked back.
 */
export const COORDINATE_CHAIN = Object.freeze({
  forward: ANCHOR_ORDER,
  reverse: [...ANCHOR_ORDER].reverse(),
  bidirectional: true,
  rule: 'a coordinate is legible from either end; the reverse walk must land on ROOT',
});

/* ── CROSSING AND INVERSE ───────────────────────────────────────────────── */

/**
 * The executable crossing primitive is xiio-handoff/x42/twist.mjs — one
 * implementation, already hostiled by X42-TWIST H1-H12. This contract owns the
 * rules; it does not restate the transform's arithmetic.
 */
export const CROSSING = Object.freeze({
  primitive_owner: 'xiio-handoff/x42/twist.mjs',
  transform: 'T180',
  grammar: 't+[i]-c -> X -> c+[i]-t -> X -> RETURN',
  invariant: 'T180 o T180 = HOME',
  mirror_hostile: 'MIRROR_ONLY != X',
  rules: Object.freeze([
    'OUTPUT_A -> INPUT_B (never OUTPUT_A <-> OUTPUT_B)',
    'orientation returns home across two transforms',
    'lineage returns home; semantic root stays traceable',
    'generation may advance without losing lineage',
    'authority does not flip, nor appear, because orientation flips',
  ]),
});

/** Forward is config -> validator -> result. The inverse must reach the bytes. */
export const INVERSE_CHAIN = Object.freeze([
  'RESULT',
  'EXACT_VALIDATOR',
  'EXACT_CONFIG_BYTES',
  'EXACT_GENERATION',
  'EXACT_OWNER',
]);

/* ── TIERS ──────────────────────────────────────────────────────────────── */

export const TIER_ORDER = Object.freeze(['BRONZE', 'SIVER', 'GOLD', 'PLATINUM']);

export const TIERS = Object.freeze({
  BRONZE: { label: 'Bronze', blurb: 'Everyday' },
  SIVER: { label: 'Siver', blurb: 'Working' },
  GOLD: { label: 'Gold', blurb: 'Advanced' },
  PLATINUM: { label: 'Platinum', blurb: 'Control' },
});

/* ── THE SCALE LADDER ───────────────────────────────────────────────────── */

/**
 * The ladder, with each rung declaring WHICH ROW it is on.
 *
 * The frame writes it as two rows, and they are not one axis:
 *
 *   the decade row   1s 10s 100s 1,000s 10,000s 100,000s 1,000,000s
 *                    amounts of WORK — how much of it a job is
 *   the operator row 1s 2s 3s 4s 5s
 *                    VERBS — reciprocal return, SOW, NEED/FEED/REAP, cube pivot
 *
 * Read as one list, a control that asks how long a job can run offers all
 * eleven and hands a job a duration it never had. `axis` is declared HERE so
 * no consumer has to split the two rows by hand — and 'both' is the one rung
 * the owner's frame puts on each.
 */
export const SCALE_LADDER = Object.freeze([
  { n: 1, label: '1s', axis: 'both', note: 'one atomic outward occurrence' },
  { n: 2, label: '2s', axis: 'operator', note: 'reciprocal return / compare / rebase' },
  { n: 3, label: '3s', axis: 'operator', note: 'SOW one qualified delta into its affected work' },
  { n: 4, label: '4s', axis: 'operator', note: 'NEED / FEED / REAP keep the active frontier level' },
  { n: 5, label: '5s', axis: 'operator', note: 'bounded cube pivot: reap the bounded projection at HOME, never HOME itself; sow typed ANTs, then collapse or expand' },
  { n: 10, label: '10s', axis: 'scale', note: 'a short burst of work' },
  { n: 100, label: '100s', axis: 'scale', note: 'a real job, start to finish' },
  { n: 1000, label: '1,000s', axis: 'scale', note: 'a long run you can walk away from' },
  { n: 10000, label: '10,000s', axis: 'scale', note: 'a background sweep' },
  { n: 100000, label: '100,000s', axis: 'scale', note: 'a day-scale process' },
  { n: 1000000, label: '1,000,000s', axis: 'scale', note: 'a season-scale process' },
]);

/** Every rung, in the owner's order — both rows. */
export const LADDER_LABELS = Object.freeze(SCALE_LADDER.map((r) => r.label));
export const LADDER_COUNTS = Object.freeze(SCALE_LADDER.map((r) => r.n));

/** The decade row — amounts of work. The only row a duration question may offer. */
export const SCALE_RUNGS = Object.freeze(SCALE_LADDER.filter((r) => r.axis !== 'operator'));
/** The operator row — verbs. */
export const OPERATOR_RUNGS = Object.freeze(SCALE_LADDER.filter((r) => r.axis !== 'scale'));

export const DECADE_LABELS = Object.freeze(SCALE_RUNGS.map((r) => r.label));
export const OPERATOR_LABELS = Object.freeze(OPERATOR_RUNGS.map((r) => r.label));

/** Is this label a rung of the decade row? A horizon that is not is UNKNOWN. */
export function isDecadeRung(label) {
  return DECADE_LABELS.includes(label);
}

/**
 * The decade row's label at a position — 0 is 1s, 4 is 10,000s. A consumer
 * that reports a rung reports a POSITION and reads the label here, so a label
 * can never be typed somewhere the ladder cannot correct it.
 */
export function decadeRungAt(index) {
  return DECADE_LABELS[index] ?? 'UNKNOWN';
}

/** The next rung above n, or null at the top. */
export function nextRung(n) {
  return SCALE_LADDER.find((r) => r.n > n)?.label ?? null;
}

/* ── HOSTILES ───────────────────────────────────────────────────────────── */

/** Negative controls against promotion. A detected hostile is PASS. */
export const HOSTILES = Object.freeze([
  'MIRROR_ONLY', 'WRONG_SIDE_COMPARE', 'ROLE_NOT_TWISTED', 'RETURN_NOT_REVERSED',
  'IDENTITY_DRIFT', 'LINEAGE_LOSS', 'AUTHORITY_APPEARS', 'WRITE_ACK_WITHOUT_READBACK',
  'PROSE_SUCCESS_WITHOUT_EFFECT', 'ARTIFACT_MISSING', 'RETURN_TARGET_MISMATCH',
  'NEIGHBOUR_REGRESSION', 'UNKNOWN_PROMOTED', 'PARTIAL_DENOMINATOR_PROMOTED',
  'AMBIGUOUS_CANARY_SINGLE_PATH', 'SURVIVOR_PROMOTED_TO_AUTHORITY', 'HUMAN_OVERRIDE_DROPPED',
]);

/**
 * The integration hostiles. These police the contract's own consumers: a
 * consumer that drifts from canonical truth is the failure they exist to catch.
 */
export const INTEGRATION_HOSTILES = Object.freeze([
  { id: 'A', name: 'rendered lattice differs from canonical contract', verdict: 'FAIL' },
  { id: 'B', name: 'AcsKernel differs from canonical contract', verdict: 'FAIL' },
  { id: 'C', name: '@ibal runtime coordinates differ from canonical contract', verdict: 'FAIL' },
  { id: 'D', name: 'COMDCCT disappears', verdict: 'FAIL' },
  { id: 'E', name: 'tier/scale ladder differs between consumers', verdict: 'FAIL' },
  { id: 'F', name: 'durable projection generation is stale', verdict: 'FAIL' },
  { id: 'G', name: 'write receipt exists without independent readback', verdict: 'NO_EFFECT' },
  { id: 'H', name: 'partial denominator attempts promotion', verdict: 'FAIL' },
  { id: 'I', name: 'UNKNOWN attempts promotion', verdict: 'FAIL' },
  { id: 'J', name: 'optimization removes evidence', verdict: 'DISQUALIFIED' },
  { id: 'K', name: 'mirror without X/T180', verdict: 'FAIL' },
  { id: 'L', name: 'round trip does not return HOME', verdict: 'FAIL' },
  { id: 'M', name: 'contract placements diverge', verdict: 'FAIL' },
]);

/* ── PROMOTION AND DENOMINATOR ──────────────────────────────────────────── */

export const PROMOTION = Object.freeze({
  rule: 'FAIL or UNKNOWN blocks promotion',
  allow: Object.freeze(['PASS']),
  blocking: Object.freeze(['FAIL', 'UNKNOWN', 'NO_EFFECT']),
  no_inheritance: 'BRONZE PASS != PLATINUM PASS; no level inherits runtime credit',
  must_be_whole: 'a partial denominator may never promote',
});

export const DENOMINATOR = Object.freeze({
  rule: 'every batch retains its full denominator',
  optimization_rule: 'optimize orchestration, never evidence denominator',
  may_reduce: Object.freeze(['orchestration', 'duplicate work', 'repeated setup', 'equivalent structural work']),
  may_never_reduce: Object.freeze([
    'evidence cells', 'independent readback', 'hostile diversity', 'X crossings',
    'neighbour regression', 'artifact/effect proof', 'FAIL', 'UNKNOWN',
  ]),
});

export const SOW_3S = Object.freeze({
  n: 3,
  operator: 'SOW',
  rule: 'SOW consumes a qualified 1→2 delta and expands only the affected next work; it may not bypass reciprocal return/compare.',
  hard: Object.freeze([
    'SOW_WITHOUT_QUALIFIED_2=OUT_OF_CADENCE',
    'SOW_EXPANDS_AFFECTED_SET_NOT_GLOBAL_FRONTIER',
  ]),
});

export const LEVELING_4S = Object.freeze({
  n: 4,
  operators: Object.freeze({
    NEED: 'A nonterminal miner bucket names the exact missing input, wake, currentness, resource or dependency. Absence may never be silent.',
    FEED: 'Route the exact qualified ANT, result or resource into the typed NEED that can consume it. FEED is not authority.',
    REAP: 'Collapse spent, false, stale or superseded active carrier while preserving provenance and any qualified semantic delta.',
  }),
  bucket_rule: 'Every nonterminal bucket has runnable ANT fuel, emits a typed NEED, or is terminal/REAPED.',
  balance_rule: 'Feed existing runnable NEED before widening that same frontier with more SOW; blocked external NEED does not starve independent work.',
  hard: Object.freeze([
    'SILENT_BUCKET=FAIL',
    'UNFED_RUNNABLE_NEED=STARVATION',
    'FEED_WITHOUT_TYPED_NEED=FLOOD_RISK',
    'REAP!=DELETE_PROVENANCE',
    'NEED!=OWNER_AS_CLOCK',
    '4S_KEEP_FRONTIER_LEVEL',
  ]),
});

export const ROUTING = Object.freeze({
  principle: 'RED=ROUTING_INFORMATION; RED!=GLOBAL_STOP',
  classes: Object.freeze(['AFFECTED','BLOCKED_BY','INDEPENDENT','ALTERNATE_ROUTE','UNKNOWN','READY']),
  rules: Object.freeze([
    'BLOCK_ONLY_TRUE_DEPENDENCY_CONE',
    'READY+INDEPENDENT+QUALIFIED_ALTERNATE_ROUTE_KEEP_EXECUTING',
    'UNKNOWN_REMAINS_IN_DENOMINATOR',
    'STARVING_INDEPENDENT_WORK=PNEUMA_FAILURE',
    'GOLD_PROMOTION_STILL_REQUIRES_COMPLETE_DENOMINATOR',
  ]),
});

export const HARD = Object.freeze([
  'FASTER != LESS PROOF',
  'WRITE_ACK != READBACK',
  'PROSE SUCCESS != EFFECT',
  'NO_READBACK => NO_EFFECT',
  'FAIL_OR_UNKNOWN_BLOCKS_PROMOTION',
  'CLEAN_MUST_MATCH_REAL_TOPOLOGY',
  'RED!=GLOBAL_STOP',
  'BLOCK_ONLY_TRUE_DEPENDENCY_CONE',
  'STARVING_INDEPENDENT_WORK=PNEUMA_FAILURE',
  'SILENT_BUCKET=FAIL',
]);

/* ── THE FRAME, VERBATIM ────────────────────────────────────────────────── */

/**
 * The owner-supplied frame, byte for byte. This is the contract's copy — the
 * only copy. PneumaLattice renders `lattice()`, it does not hold its own.
 *
 * The closing block is the owner's amendment, supplied on the frame itself:
 * the recovery sequence, [pneuma] + [burn] + [triage] -> [heal] -> [resume].
 * It is carried on the frame rather than on a surface because the frame is what
 * @ibal addresses — a recovery chain declared anywhere else is a chain @ibal
 * cannot read.
 *
 * The frame's bytes are deliberately outside canonicalDigest(). The digest
 * covers the values the contract DECLARES; the frame is the thing they are
 * declared for. Hashing it would make an owner amendment read as a contract
 * change — it advances no generation, but it would invalidate the durable
 * projection and fail hostile F for a reason that is not a defect.
 *
 * AMENDED — the frame below is the owner's full frame, re-supplied 2026-09-27.
 * The previous array was an abridged variant of it: it dropped @ibal, the
 * [ROOT] rail row, every live slot on the P N E U M A bars, the second grid,
 * the expanded recovery ladder, the [go!] {[HOME!]} line, the tag block and the
 * CONNECT SEAMS footer — and it spelled the rail COMDCCT where the owner's
 * frame spells COMS. This is an owner amendment to the frame's bytes, which sit
 * outside canonicalDigest(): generation does not advance and the durable
 * projection is not invalidated. COMDCCT is NOT deleted — it remains in
 * ANCHOR_ORDER, ANCHORS, FRAME and registry.jsx, which is where the collision
 * between COMS and COMDCCT stays visible instead of being quietly resolved.
 */
export const LATTICE_LINES = Object.freeze([
  '     @ibal',
  '     ',
  '     [ROOT]',
  '     [BASE][HOME][COMS]+[COMPASS][PAYLOAD]+[TIME][BILLING][DELIVERED]',
  '     \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2193    \u2195',
  '          [  ]| !! | !! | !! | !! |  P N E U M A | !! | !! | !! |[   ]| !! | !! | ',
  '   \u221e ___________________________________________________\u221e',
  '     |/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|',
  '   \u21aa  X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X \u21a9',
  '     |\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /|',
  '  \u2194  1+\\  2+ / 3+\\  4+ / 5+\\  6+ / 7+\\  8+ / 9+\\  0+ / | \u2194',
  '     |  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195',
  '     |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   | ',
  '  t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c',
  '     |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |',
  '     |  / \u2195 \\  \u2195  / \u2195 \\  \u2195  / \u2195 \\  \u2195  / \u2195 \\  \u2195  / \u2195 \\  \u2195',
  '  \u2194 -0\u2194/-1\u2194 \\-2\u2194/ -3\u2194 \\-4\u2194/ -5 \u2194\\-6\u2194/ -7\u2194 \\-8\u2194/ -9\u2194  \\ |',
  '     |/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|',
  '     i t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-cX t+[i]-c  X ',
  '     |\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|',
  '  \u2194  0 \\ -9\u2194 /-8\u2194\\ -7\u2194 /-6\u2194\\ -5\u2194 /-4\u2194\\ -3\u2194 /-2\u2194\\ -1\u2194 / | \u2194',
  '     |  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195',
  '     |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |',
  '  c+[i]-t X c+[i]-t X c+[i]-t X c+[i]-t X c+[i]-t X c+[i]-t',
  '     |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |',
  '  \u2194 -0  /-1\u2194\\ -2\u2194 /-3\u2194\\ -4\u2194 /-5\u2194\\ -6\u2194 /-7\u2194\\ -8\u2194 /-9\u2194\\  | \u2194',
  '     | /  |  \\ | /  |  \\ | /  |  \\ | /  |  \\ | /  |  \\ |',
  '     |/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|',
  '   \u21aa  X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X \u21a9  ',
  '     |\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /|',
  '  \u2194  1+\\ \u21942+ /\u21943+\\ \u21944+ /\u21945+\\ \u21946+ /\u21947+\\\u2194 8+ /\u21949+\\ \u21940+ / | \u2194',
  '     |  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195',
  '     |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   | ',
  '     |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |    ',
  '   \u221e |_________________________________________________|\u221e',
  '     | !! | !! | !! | !! | P N E U M A  | !! | !! | !! |',
  '     \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    ',
  '',
  '      [BRONZE][SIVER][GOLD][PLATINUM]    ',
  '      [1s],[10s][100s][1,000s][10,000s][100,000s][1,000,000s]',
  '      _______________________________________________________________________   ',
  '          [  ]| !! | !! | !! | !! |  P N E U M A | !! | !! | !! |[   ]| !! | !! | ',
  '      [1s] ',
  '      [2s]',
  '      [3s]',
  '      [4s]',
  '      [5s]',
  '      _______________________________________________________________________',
  '      [pneuma] + [burn] + [triage]',
  '          [  ]| !! | !! | !! | !! |  P N E U M A | !! | !! | !! |[   ]| !! | !! | ',
  '      [heal]',
  '      ',
  '      [resume]',
  '      _______________________________________________________________________',
  '      [pneuma] + [burn] + [triage]',
  '          [  ]| !! | !! | !! | !! |  P N E U M A | !! | !! | !! |[   ]| !! | !! | ',
  '      [heal]',
  '      ',
  '      [go!] {[HOME!]}',
  '      ',
  '      +tic #date #time @crm, #bugs #tasks @dataforge ',
  '      +cogs #date_project #date_time @teams, #bug_wrangle, bug_excute!',
  '      @ibal #reap +!gamify +!plan +!ship',
  '      _______________________________________________________________________',
  '       ',
  '           \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2193      \u2195             ',
  '          [  ]| !! | !! | !! | !! |  P N E U M A | !! | !! | !! |[   ]| !! | !! | ',
  '   \u221e ___________________________________________________\u221e',
  '     |/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|',
  '   \u21aa  X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X \u21a9',
  '     |\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /|',
  '  \u2194  1+\\  2+ / 3+\\  4+ / 5+\\  6+ / 7+\\  8+ / 9+\\  0+ / | \u2194',
  '     |  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195',
  '     |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   | ',
  '  t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c',
  '     |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |',
  '     |  / \u2195 \\  \u2195  / \u2195 \\  \u2195  / \u2195 \\  \u2195  / \u2195 \\  \u2195  / \u2195 \\  \u2195',
  '  \u2194 -0\u2194/-1\u2194 \\-2\u2194/ -3\u2194 \\-4\u2194/ -5 \u2194\\-6\u2194/ -7\u2194 \\-8\u2194/ -9\u2194  \\ |',
  '     |/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|',
  '     i t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-cX t+[i]-c  X ',
  '     |\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|',
  '  \u2194  0 \\ -9\u2194 /-8\u2194\\ -7\u2194 /-6\u2194\\ -5\u2194 /-4\u2194\\ -3\u2194 /-2\u2194\\ -1\u2194 / | \u2194',
  '     |  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195',
  '     |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |',
  '  c+[i]-t X c+[i]-t X c+[i]-t X c+[i]-t X c+[i]-t X c+[i]-t',
  '     |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |',
  '  \u2194 -0  /-1\u2194\\ -2\u2194 /-3\u2194\\ -4\u2194 /-5\u2194\\ -6\u2194 /-7\u2194\\ -8\u2194 /-9\u2194\\  | \u2194',
  '     | /  |  \\ | /  |  \\ | /  |  \\ | /  |  \\ | /  |  \\ |',
  '     |/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|',
  '   \u21aa  X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X t+[i]-c X \u21a9  ',
  '     |\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /\u2195\\   \u2195   /|',
  '  \u2194  1+\\ \u21942+ /\u21943+\\ \u21944+ /\u21945+\\ \u21946+ /\u21947+\\\u2194 8+ /\u21949+\\ \u21940+ / | \u2194',
  '     |  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195  \\ \u2195 /  \u2195',
  '     |   \\|/   |   \\|/   |   \\|/   |   \\|/   |   \\|/   | ',
  '     |   /|\\   |   /|\\   |   /|\\   |   /|\\   |   /|\\   |    ',
  '   \u221e |_________________________________________________|\u221e',
  '     | !! | !! | !! | !! | P N E U M A  | !! | !! | !! |',
  '     \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195    \u2195   ',
  '     __________________________________________________',
  '          [  ]| !! | !! | !! | !! |  P N E U M A | !! | !! | !! |[   ]| !! | !! | ',
  '     CONNECT SEAMS %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%###############',
  '      _______________________________________________________________________',
  '     $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$###############',
]);

/** The frame as one string. The only renderer of these bytes. */
export function lattice() {
  return LATTICE_LINES.join('\n');
}

/* ── THE FRAME'S LIVE SLOTS ─────────────────────────────────────────────── */

/**
 * The frame is a TEMPLATE, not a picture.
 *
 * Two of its marks are slots, and a frame rendered with the slots unresolved is
 * a diagram OF a loop rather than a loop. The recursive cube turns — the whole
 * point of it is that it turns — and a still frame cannot show that it does.
 * That is what "not updates properly" is: the shape is right, the motion is
 * absent, and a thing that cannot move cannot be walked.
 *
 * These are the only two substitutions the contract permits. Anything else
 * written into the frame is a second author.
 */
export const FRAME_SLOTS = Object.freeze({
  't+[i]-c': 'tick + index − cycle · the outward leg of the crossing',
  'c+[i]-t': 'cycle + index − tick · the return leg, the inverse of the same crossing',
});

/** The decade ring both the tick and the cycle run on — the ±0…9 bands. */
export const LOOP_RING = 10;

/**
 * Where the loop is, read from wall clock.
 *
 * One tick per second is the ladder's own first rung — "one atomic outward
 * occurrence" — so the frame is driven by the smallest unit the contract
 * already declares rather than by an invented one. Both values run on the ring,
 * which is what keeps a turning frame exactly as wide as a still one: the
 * moment the loop is legible it is also stable, and the moment it is stable it
 * stops shoving the surfaces around it.
 */
export function loopState(atMs, fromMs) {
  const elapsed = Math.max(0, Math.floor((atMs - fromMs) / 1000));
  return {
    elapsed,
    tick: elapsed % LOOP_RING,
    cycle: Math.floor(elapsed / LOOP_RING) % LOOP_RING,
    turns: Math.floor(elapsed / (LOOP_RING * LOOP_RING)),
  };
}

/**
 * The frame with its slots resolved — what a surface renders.
 *
 * `lattice()` stays the verbatim template and is not touched, so a consumer
 * comparing bytes against canonical truth still compares the owner's bytes.
 * This is a projection OF that template, produced BY the contract, so a
 * rendered frame is contract output rather than a consumer's paraphrase of it.
 */
export function projectFrame(state = {}) {
  const tick = state.tick ?? 0;
  const cycle = state.cycle ?? 0;
  return LATTICE_LINES.map((line) =>
    line
      .replace(/t\+\[i\]-c/g, `t+${tick}-${cycle}`)
      .replace(/c\+\[i\]-t/g, `c+${cycle}-${tick}`),
  ).join('\n');
}

/* ── THE RECOVERY SEQUENCE ──────────────────────────────────────────────── */

/**
 * The recovery block the owner added to the frame, in the order it is written.
 *
 * Declared for the same reason the tiers and the ladder are: a value the frame
 * carries must have one owner, or a consumer will quietly grow a copy of it.
 *
 * Its SEMANTICS are not established here. ANCHORS.COMDCCT could be declared
 * with meaning because registry.jsx already carried that meaning; nothing in
 * this repository defines what burn, triage, heal or resume actually do, and a
 * guess written into canonical truth is worse than a marked absence. The order
 * is the owner's; the meaning is not yet ours to state.
 */
export const RECOVERY = Object.freeze({
  sequence: Object.freeze(['pneuma', 'burn', 'triage', 'heal', 'resume']),
  semantics: 'ESTABLISHED_2026_09_27',
  stages: Object.freeze({
    pneuma: 'Census current truth, retain the whole denominator, and keep every independently runnable path moving.',
    burn: 'Run the applicable cells and hostiles; a red is routing information, not a project-wide stop.',
    triage: 'Partition the denominator into AFFECTED, BLOCKED_BY, INDEPENDENT, ALTERNATE_ROUTE, UNKNOWN and READY.',
    heal: 'Repair or reroute the damaged seam inside its true blast radius, then obtain readback.',
    resume: 'Reconnect the healed seam, run newly unblocked work, return HOME, account tics/cogs/tasks/bugs, REAP, plan and ship.',
  }),
  post_go: Object.freeze(['HOME','TIC_COG_ACCOUNTING','CRM_BUGS_TASKS','TEAMS_WRANGLE_EXECUTE','REAP_GAMIFY_PLAN_SHIP','CONNECT_SEAMS']),
});

/* ── THE 00s STEERING FORMATION ─────────────────────────────────────────── */

/**
 * 00s is not a batch size.
 *
 * The estate read the scale row as a worker count — 100s as one hundred things,
 * done one after another — and that reading turns exponential computational
 * scale into exponential human cognitive load, which is the one thing it must
 * never become.
 *
 * The owner's correction is that 00s is a FORMATION: the recursive steering
 * between exponential scales. The same geometry conducts every exponent —
 *
 *     1s -> 00s -> 10s -> 00s -> 100s -> 00s -> 1,000s -> ...
 *
 * — and an exponent is not a larger workflow, it is the same addressed binary
 * formation applied again. It is declared here, and deliberately NOT on
 * SCALE_LADDER, because the ladder's decade row is AMOUNTS OF WORK and 00s is
 * not an amount of it: a duration control that offered 00s would hand a job a
 * duration it never had, which is the defect the ladder's own axis note already
 * warns about.
 *
 * x42 and x43 stay LITERAL. Their presence is supplied operating grammar, and
 * manufacturing a definition for an operator the owner has not yet qualified
 * would put a guess into canonical truth.
 */
export const STEERING = Object.freeze({
  schema: 'xiio.pneuma.steering/v1',
  rung: '00s',
  is: 'the recursive steering formation that conducts each exponential 1s scale',
  is_not: Object.freeze([
    'a batch size',
    '100 independent workers',
    '100 human-visible results',
  ]),
  recurrence: Object.freeze([
    '1s', '00s', '10s', '00s', '100s', '00s',
    '1,000s', '00s', '10,000s', '00s', '100,000s', '00s', '1,000,000s',
  ]),
  chain: Object.freeze([
    'ADDRESS',
    '1s BINARY_DECOMPOSITION',
    '3x3x3 RECIPROCAL_COVERAGE',
    '00s FORMATION',
    'QUANTIZE_EQUIVALENT_TRUTH',
    'FRACTALIZE_DISTINCT_REDS',
    'x42/x43 PROJECTION_AS_QUALIFIED',
    'NEXT_EXPONENTIAL_SCALE',
    'PNEUMA',
    'CONNECT_SEAMS',
    'PPTM',
    'BURN_TRIAGE_HEAL_RESUME',
    'RESULT_RETURN_READBACK_REAP',
    'HOME_0',
    'NEXT_1',
  ]),
  operations: Object.freeze({
    QUANTIZE: 'compress structurally equivalent truth',
    FRACTALIZE: 'expand materially distinct reds',
    CROSS: 'hostile reciprocal crossings',
    PRESERVE: 'preserve provenance',
    SUPPRESS: 'suppress unnecessary human projection',
  }),
  pptm: Object.freeze({
    rule: 'PPTM belongs inside the steering calculation, not after the work as reporting.',
    operators: Object.freeze(['PROJ', 'PRIORITY', 'TIME', 'MONEY']),
  }),
  literal_operators: Object.freeze(['x42', 'x43']),
  literal_rule: 'x42 and x43 remain literal until qualified; their presence is supplied operating grammar, never a definition',
  home: 'Studio is always ROOT for every tool @ibal needs for a 1 to become a 0 again and reset the stacks',
  semantics: 'ESTABLISHED_2026_09_28',
});

/**
 * The invariant 00s exists to hold.
 *
 * More 1s must buy stronger steering, stronger compression and fewer human
 * crossings — never more of them. A scale increase that raises owner cog load
 * proportionally is the failure this formation is against.
 */
export const COG_LOAD_INVARIANT = Object.freeze({
  rule: 'COMPUTATIONAL SCALE rises exponentially; HUMAN COG LOAD must not rise proportionally.',
  hard: Object.freeze([
    'MORE_SCALE != MORE_HUMAN_INTERRUPTION',
    'MORE_AGENTS != MORE_WINDOWS',
    'MORE_RESULTS != MORE_OWNER_DECISIONS',
    'SUBTERRANEAN_WORK_STAYS_HEADLESS',
    'ONLY_OWED_QUALITATIVE_CROSSINGS_RISE_INTO_STUDIO',
  ]),
  routing: 'MORE_1s -> STRONGER_00s -> STRONGER_FAN_IN -> FEWER_BETTER_HUMAN_CROSSINGS',
});

/* ── DIGEST ─────────────────────────────────────────────────────────────── */

/** FNV-1a over the canonical body. Consumers compare this, not their own copy. */
export function canonicalDigest() {
  const body = JSON.stringify({
    CONTRACT, GENERATION, LINEAGE, ANCHOR_ORDER, ANCHORS, FRAME,
    COORDINATE_CHAIN, CROSSING, INVERSE_CHAIN, TIER_ORDER, TIERS,
    SCALE_LADDER, SOW_3S, LEVELING_4S, ROUTING, HOSTILES, INTEGRATION_HOSTILES, PROMOTION, DENOMINATOR, RECOVERY, HARD,
    STEERING, COG_LOAD_INVARIANT,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i += 1) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, '0')}`;
}

/* ── THE FRAME AS STATE ─────────────────────────────────────────────────── */

/**
 * The frame a principal is actually operating from, read from state — not from
 * prose. A declaration is not a binding, so this returns the coordinates it can
 * actually account for and marks the rest UNKNOWN.
 */
export function frameState(state = {}) {
  const rung = state.rung ?? null;
  const rungIndex = rung == null ? -1 : SCALE_LADDER.findIndex((r) => r.n === rung);
  return {
    contract: CONTRACT,
    generation: GENERATION,
    lineage: state.lineage ?? LINEAGE,
    digest: canonicalDigest(),
    frame: FRAME,
    anchors: ANCHOR_ORDER,
    coordinates: {
      ROOT: state.ROOT ?? 'UNKNOWN',
      BASE: state.BASE ?? 'UNKNOWN',
      HOME: state.HOME ?? 'UNKNOWN',
      COMDCCT: state.COMDCCT ?? 'UNKNOWN',
    },
    rung: rung == null ? 'UNKNOWN' : SCALE_LADDER[rungIndex]?.label ?? 'UNKNOWN',
    rung_index: rungIndex,
    tier: state.tier && TIER_ORDER.includes(state.tier) ? state.tier : 'UNKNOWN',
    bound: ANCHOR_ORDER.every((a) => state[a] != null && state[a] !== 'UNKNOWN'),
  };
}

/** Does this frame agree with canonical truth on generation, lineage and rails? */
export function frameAgrees(frame) {
  const failures = [];
  if (frame?.contract !== CONTRACT) failures.push('CONTRACT_MISMATCH');
  if (frame?.generation !== GENERATION) failures.push('GENERATION_MISMATCH');
  if (frame?.digest !== canonicalDigest()) failures.push('DIGEST_MISMATCH');
  if (JSON.stringify(frame?.anchors) !== JSON.stringify(ANCHOR_ORDER)) failures.push('ANCHOR_ORDER_MISMATCH');
  if (!ANCHOR_ORDER.includes('COMDCCT')) failures.push('COMDCCT_MISSING');
  if (frame?.tier && frame.tier !== 'UNKNOWN' && !TIER_ORDER.includes(frame.tier)) failures.push('TIER_NOT_CANONICAL');
  return { pass: failures.length === 0, failures };
}

/* ── PROMOTION ──────────────────────────────────────────────────────────── */

/** Whole denominator, every cell PASS, nothing UNKNOWN. Otherwise blocked. */
export function canPromote(cells = [], denominator = null) {
  if (!cells.length) return false;
  if (cells.some((c) => c.state === 'UNKNOWN' || c.state === 'NO_EFFECT')) return false;
  if (cells.some((c) => c.state !== 'PASS')) return false;
  if (denominator != null && cells.length !== denominator) return false;
  return true;
}

/** Every consumer that must agree with this contract. */
export const CONSUMERS = Object.freeze([
  'src/components/framework/PneumaLattice.jsx',
  'src/components/framework/registry.jsx',
  'src/components/config/ConfigQualificationPanel.jsx',
  'src/components/config/ConfigScaleLadder.jsx',
  'base44/shared/configSimContract.mjs',
  'scripts/run-pneuma-batch.mjs',
  'base44/agents/Ibal.jsonc',
  'src/components/acs/PneumaCube.jsx',
  'src/lib/pneumaLattice.js',
  /* The onboarding surface hands a worker a coordinate before any work, and it
     did so from outside this list — so hostile A, "rendered lattice differs
     from canonical contract", had nothing to compare it against. That is the
     same silence PneumaCube sat in, and it is closed the same way. */
  'src/components/framework/publisher.jsx',
]);

/** The backend placement of this same contract. */
export const BACKEND_PLACEMENT = 'base44/shared/pneumaContract.mjs';