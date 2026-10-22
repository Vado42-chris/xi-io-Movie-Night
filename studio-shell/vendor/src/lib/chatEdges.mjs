/**
 * CHAT EDGES / THREE LANES ON ONE WINDOW
 *
 * One conversation docked to one target is the model the estate already had, and
 * it answers "where does this conversation live". It does not answer "how many
 * conversations does this window carry", because it assumed the answer was one —
 * and one is wrong. A window is a cube, and a conversation is ONE of a cube's
 * bindings rather than the only one. Three are useful at once, and they are
 * useful for three different reasons, which is why they are named rather than
 * being three anonymous slots.
 *
 * ── WHY THESE THREE, AND WHY NOT RIGHT ──────────────────────────────────────
 *
 * A window has four edges and only three of them can hold a lane. RIGHT is
 * deliberately excluded: it is where the surface's OWN tools already stand (see
 * ChatSnapControl), and a lane there would be a conversation sitting on top of
 * the controls for the thing the conversation is about.
 *
 * ── THE ADDRESS IS WHAT MAKES THREE POSSIBLE ────────────────────────────────
 *
 * `chatAttachments` holds one invariant that everything else reads: a binding's
 * `target_ref` IS the conversation identity — one window, one conversation, one
 * name. Three lanes on one window would collide under that rule.
 *
 * So the lane's address is the window's own ref PLUS the edge it sits on. Three
 * lanes are then three distinct addresses rather than three records competing
 * for one name, and a lane still names the window it belongs to — which is what
 * lets `lanesOf` group them back together without a second identity system.
 *
 * A window with no lane keeps carrying its own bare ref, so the existing single
 * binding is untouched by any of this.
 */
export const CHAT_EDGE_SCHEMA = 'xiio.chat-edges/v1';

export const CHAT_EDGE = Object.freeze({ TOP: 'TOP', LEFT: 'LEFT', BOTTOM: 'BOTTOM' });

/* Declared order, and it is the reading order: what the window IS, what it
   NEEDS, what it DID. A lane list in any other order would be a set pretending
   to be a sequence. */
export const EDGE_ORDER = Object.freeze(['TOP', 'LEFT', 'BOTTOM']);

/* ── WHAT EACH EDGE IS FOR, AND IT IS THE TRINITY ────────────────────────────
 *
 * The three lanes are not three anonymous slots and they are not three copies of
 * one context. They are the estate's own balance — HOME, WORK and LIFE — carried
 * onto the window a person is working in, because that is where the balance is
 * actually spent and where it is easiest to lose.
 *
 * The legs are the owner's, declared in the order the window reads:
 *
 *   HOME   what this work costs you and what it gives back — the life balance
 *   WORK   what it is worth, who pays for it, and what it has to earn
 *   LIFE   what can be automated so it stops needing you at all
 *
 * Declared here rather than left to whoever draws the lanes, so a conversation
 * put on the wrong leg is a finding rather than a preference — and so a surface
 * offering the three can say what it is offering. The automation leg is named
 * LIFE and not "efficiency" on purpose: the point of automating something is to
 * give the hours back, and a lane that only ever spoke about throughput would be
 * measuring the wrong end of it.
 */
export const EDGE_TRINITY = Object.freeze({ TOP: 'HOME', LEFT: 'WORK', BOTTOM: 'LIFE' });

export const EDGE_MEANING = Object.freeze({
  TOP: 'HOME — the life balance: what this work costs you and what it gives back',
  LEFT: 'WORK — the money and the business: what this is worth and who pays for it',
  BOTTOM: 'LIFE — what can be automated so it stops needing you at all',
});

/* ── THE THREE-LETTER MARKS ──────────────────────────────────────────────────
 *
 * Each leg is named in full (HOME, WORK, LIFE) and marked in three letters, and
 * the mark is what a lane wears when there is only room for one word. It is
 * declared HERE, beside the leg it names, so the long form and the short form
 * cannot come apart — and so the shell's acronym registry can carry the
 * expansion rather than a second copy of the meaning.
 *
 * HOM, WRK and LIF are three letters each, so they land on the odd plane by the
 * estate's own rule (src/lib/acronyms.js) — the TLA plane — without anybody
 * declaring which plane they belong to. */
export const EDGE_TLA = Object.freeze({ TOP: 'HOM', LEFT: 'WRK', BOTTOM: 'LIF' });

const SEP = '#';

export const isEdge = (edge) => EDGE_ORDER.includes(edge);

/* ── THE ADDRESS ─────────────────────────────────────────────────────────────
 *
 * `lastIndexOf` and not `indexOf`: a target_ref is a surface path and may itself
 * contain the separator, so only a KNOWN edge as the final segment is read as
 * one. A ref that ends in anything else is left exactly as it was, which is what
 * keeps a bare window ref parseable as itself.
 */
export function edgeRef(target_ref, edge) {
  if (!target_ref) return null;
  if (!isEdge(edge)) return target_ref;
  return `${target_ref}${SEP}${edge}`;
}

export function parseEdgeRef(ref) {
  if (!ref) return { target_ref: null, edge: null };
  const at = String(ref).lastIndexOf(SEP);
  if (at < 0) return { target_ref: ref, edge: null };
  const edge = String(ref).slice(at + 1);
  return isEdge(edge)
    ? { target_ref: String(ref).slice(0, at), edge }
    : { target_ref: ref, edge: null };
}

/* ── ONE WINDOW'S THREE LANES ────────────────────────────────────────────────
 *
 * Always three entries in the declared order, whether or not they are occupied.
 * An unoccupied lane is EMPTY — a real answer, named — and never omitted, because
 * a surface that renders two lanes and hides the third cannot say the third
 * exists, and a person cannot put a conversation somewhere they were never shown.
 *
 * A binding on the bare window ref is NOT a lane. It is the single dock, which
 * still works and is a different thing: it is the conversation for the window as
 * a whole rather than for one of its edges. Counting it as a lane would be the
 * same collision this module exists to avoid.
 */
export function lanesOf(bindings, target_ref) {
  if (!target_ref) return [];
  const mine = (bindings ?? []).filter((b) => {
    if (!b || b.attached === false) return false;
    return parseEdgeRef(b.target_ref).target_ref === target_ref;
  });

  return EDGE_ORDER.map((edge) => {
    const held = mine.find((b) => parseEdgeRef(b.target_ref).edge === edge);
    return {
      edge,
      state: held ? 'OCCUPIED' : 'EMPTY',
      target_ref,
      address: edgeRef(target_ref, edge),
      conversation_ref: held?.target_ref ?? null,
      label: held?.label ?? null,
      trinity: EDGE_TRINITY[edge],
      tla: EDGE_TLA[edge],
      meaning: EDGE_MEANING[edge],
    };
  });
}

/* The reading, stated once: how many of the three are held. A window that says
   "2 of 3" can be told apart from one that never had three. */
export function laneQuorum(bindings, target_ref) {
  const lanes = lanesOf(bindings, target_ref);
  const occupied = lanes.filter((l) => l.state === 'OCCUPIED');
  return {
    lanes,
    occupied: occupied.length,
    empty: lanes.length - occupied.length,
    edges: occupied.map((l) => l.edge),
    quorum: `${occupied.length}/${lanes.length}`,
  };
}

/* ── MAY THIS BIND? ──────────────────────────────────────────────────────────
 *
 * A VALIDATOR, not a writer. It answers whether a bind may proceed and names the
 * refusal; the caller does the write. Splitting it this way is what keeps the
 * rule in one place while the store stays the only thing that mutates — and it
 * means a surface offering a lane can say WHY it refused instead of silently
 * doing nothing.
 *
 * A re-bind of the same conversation to the same lane is not a change: it is the
 * same lane, and refusing it would make refreshing a binding look like a fault.
 */
export function mayBindLane(bindings, { target_ref, edge, conversation_ref } = {}) {
  if (!target_ref) return { ok: false, first_red: 'TARGET_REQUIRED' };
  if (!isEdge(edge)) return { ok: false, first_red: 'EDGE_REQUIRED' };

  const held = lanesOf(bindings, target_ref).find((l) => l.edge === edge);
  if (held?.state === 'OCCUPIED') {
    return held.conversation_ref === conversation_ref
      ? { ok: true, already: true }
      : { ok: false, first_red: 'EDGE_OCCUPIED', held: held.conversation_ref };
  }

  /* One conversation may lead one lane on one window. Putting the same
     conversation on two edges of the same window is not two conversations — it
     is one conversation wearing two addresses, and the second one would be a
     copy that drifts. */
  const elsewhere = lanesOf(bindings, target_ref)
    .find((l) => l.state === 'OCCUPIED' && l.conversation_ref === conversation_ref);
  if (elsewhere) {
    return { ok: false, first_red: 'CONVERSATION_ALREADY_ON_WINDOW', held: elsewhere.edge };
  }

  return { ok: true, address: edgeRef(target_ref, edge) };
}

export const LANE_MEANING = Object.freeze({
  lane: 'ONE EDGE OF ONE WINDOW, HELD BY ONE CONVERSATION',
  law: 'A LANE IS AN ADDRESS, NOT A SLOT — THREE LANES ARE THREE NAMES, NOT ONE NAME THREE TIMES',
});