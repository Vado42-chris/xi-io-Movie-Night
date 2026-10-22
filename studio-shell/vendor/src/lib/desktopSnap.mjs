/* ── SNAPPING ONE WINDOW TO ANOTHER ──────────────────────────────────────────
 *
 * The desktop already had ONE kind of snap: round the position to the lattice
 * the icons sit on. That is a snap to the GRID. It is not a snap to anything
 * else on the desktop, so two windows could never be brought flush — a chat
 * dragged toward a product came to rest wherever the lattice put it, which is
 * how a person ends up with two panels that nearly line up and never quite do.
 *
 * Two things are declared here, and they are different:
 *
 *   A JOIN     the two windows end up FLUSH and side by side. This is the one
 *              that makes a chat and a product a workstation rather than two
 *              windows that happen to be nearby.
 *
 *   AN ALIGN   the windows do not touch, but an edge they already nearly share
 *              is brought onto the same line. A row of windows then shares one
 *              edge instead of nearly sharing it.
 *
 * A join is only taken when the two windows already OVERLAP along the other
 * axis. Without that test a window dragged anywhere near a neighbour's
 * horizontal band would be flung to its side from across the desktop, which is
 * not a snap, it is a magnet.
 *
 * The result is a plain position. Nothing here writes to the desktop, so the
 * same function answers both the live preview and the drop.
 */

/* How close an edge has to come before it grabs. 24px is roughly the width of
   a window's own border plus the hand's own error — near enough to be
   deliberate, far enough that passing a window does not catch on it. */
export const SNAP_THRESHOLD = 24;

/* How close two edges have to be before they are treated as the same line. */
export const ALIGN_THRESHOLD = 8;

const rectOf = (r) => ({
  left: r.x,
  right: r.x + r.w,
  top: r.y,
  bottom: r.y + r.h,
});

/* Do two spans share any ground at all? Touching exactly counts as sharing.
 *
 * ── AND A HAND'S ERROR COUNTS AS SHARING ──────────────────────────────────
 *
 * This required the two spans to ALREADY overlap on the other axis, so the join
 * only fired for somebody who had lined the windows up by eye first — which is
 * the work the join exists to do. Two windows brought side by side are rarely
 * at the same height, so the drop was simply left where it was and the join read
 * as broken. The tolerance is the same distance the join itself reaches, so a
 * near miss is taken and a window across the field still is not. */
const sharesGround = (a1, a2, b1, b2, tolerance = 0) =>
  Math.min(a1, a2) - tolerance <= Math.max(b1, b2) && Math.max(a1, a2) + tolerance >= Math.min(b1, b2);

/* ── THE FAR AXIS OF A JOIN ─────────────────────────────────────────────────
 *
 * Two windows brought flush are flush on BOTH axes. A pair that meets on one
 * edge and floats past each other on the other is not a workstation, it is a
 * near miss — so the far axis is taken as well when it is already within the
 * alignment distance, and left exactly as it was when it is not. `null` is a
 * real answer: the axis does not move. */
const alignFar = (aStart, aEnd, bStart, bEnd, own, align) => {
  if (Math.abs(aStart - bStart) <= align) return bStart;
  if (Math.abs(aEnd - bEnd) <= align) return bEnd - own;
  return null;
};

function findJoin(a, rect, list, threshold, align = ALIGN_THRESHOLD) {
  let best = null;
  const take = (candidate) => {
    if (!best || candidate.distance < best.distance) best = candidate;
  };

  for (const other of list) {
    if (!other || typeof other.x !== 'number') continue;
    const b = rectOf(other);

    /* Side by side. The window takes the neighbour's edge as its own, and its
       far axis is aligned when the two are already within a hand's error. */
    if (sharesGround(a.top, a.bottom, b.top, b.bottom, threshold)) {
      const span = { from: Math.min(a.top, b.top), to: Math.max(a.bottom, b.bottom) };
      const y = alignFar(a.top, a.bottom, b.top, b.bottom, rect.h, align) ?? rect.y;

      const dLeft = Math.abs(a.left - b.right);
      if (dLeft <= threshold) {
        take({ x: b.right, y, distance: dLeft, docked: other.id, edge: 'left', guide: { axis: 'x', at: b.right, ...span } });
      }

      const dRight = Math.abs(a.right - b.left);
      if (dRight <= threshold) {
        take({ x: b.left - rect.w, y, distance: dRight, docked: other.id, edge: 'right', guide: { axis: 'x', at: b.left, ...span } });
      }
    }

    /* Stacked. Same idea on the other axis. */
    if (sharesGround(a.left, a.right, b.left, b.right, threshold)) {
      const span = { from: Math.min(a.left, b.left), to: Math.max(a.right, b.right) };
      const x = alignFar(a.left, a.right, b.left, b.right, rect.w, align) ?? rect.x;

      const dTop = Math.abs(a.top - b.bottom);
      if (dTop <= threshold) {
        take({ x, y: b.bottom, distance: dTop, docked: other.id, edge: 'top', guide: { axis: 'y', at: b.bottom, ...span } });
      }

      const dBottom = Math.abs(a.bottom - b.top);
      if (dBottom <= threshold) {
        take({ x, y: b.top - rect.h, distance: dBottom, docked: other.id, edge: 'bottom', guide: { axis: 'y', at: b.top, ...span } });
      }
    }
  }

  return best;
}

function findAlignment(a, rect, list, align) {
  let best = null;
  const take = (candidate) => {
    if (!best || candidate.distance < best.distance) best = candidate;
  };

  for (const other of list) {
    if (!other || typeof other.x !== 'number') continue;
    const b = rectOf(other);
    const spanX = { from: Math.min(a.left, b.left), to: Math.max(a.right, b.right) };
    const spanY = { from: Math.min(a.top, b.top), to: Math.max(a.bottom, b.bottom) };

    const dTop = Math.abs(a.top - b.top);
    if (dTop <= align) take({ x: rect.x, y: b.top, distance: dTop, guide: { axis: 'y', at: b.top, ...spanX } });

    const dBottom = Math.abs(a.bottom - b.bottom);
    if (dBottom <= align) take({ x: rect.x, y: b.bottom - rect.h, distance: dBottom, guide: { axis: 'y', at: b.bottom, ...spanX } });

    const dLeft = Math.abs(a.left - b.left);
    if (dLeft <= align) take({ x: b.left, y: rect.y, distance: dLeft, guide: { axis: 'x', at: b.left, ...spanY } });

    const dRight = Math.abs(a.right - b.right);
    if (dRight <= align) take({ x: b.right - rect.w, y: rect.y, distance: dRight, guide: { axis: 'x', at: b.right, ...spanY } });
  }

  return best;
}

/* How close a dropped widget's corner has to be to another widget's corner for
   the drop to mean "stack these" rather than "join these". The desktop owns the
   stack gesture (handleWidgetMove) and this is the same zone, so the two
   gestures cannot both claim one drop. */
export const STACK_ZONE = 50;

/* ── DROPPING ONE ON ANOTHER ─────────────────────────────────────────────────
 *
 * The join above only ever fired when two EDGES were within reach of each other,
 * which is the gesture of bringing one up BESIDE another. Dragging one ONTO
 * another — the gesture this is actually about — puts the dragged edge deep
 * inside the target, far from any edge of it, so nothing was within reach and
 * the drop was simply left overlapping. That is why dropping a widget on a
 * window did nothing at all.
 *
 * A drop lands on a pane when the dragged pane's CENTRE is inside it. The pane
 * then comes to rest flush against whichever side it has to travel least to
 * reach, so it is moved out of the way by the smallest amount and the join reads
 * as the drop settling rather than being thrown somewhere. A side that would
 * leave the field is not offered. */
function findOverlapJoin(a, rect, list, opts) {
  const cx = (a.left + a.right) / 2;
  const cy = (a.top + a.bottom) / 2;
  const field = opts.field || null;
  let best = null;

  for (const other of list) {
    if (!other || typeof other.x !== 'number') continue;

    if (
      opts.dragKind === 'widget' && other.kind === 'widget' &&
      Math.abs(rect.x - other.x) < STACK_ZONE && Math.abs(rect.y - other.y) < STACK_ZONE
    ) continue;

    const b = rectOf(other);
    if (!(cx > b.left && cx < b.right && cy > b.top && cy < b.bottom)) continue;

    const spanY = { from: Math.min(a.top, b.top), to: Math.max(a.bottom, b.bottom) };
    const spanX = { from: Math.min(a.left, b.left), to: Math.max(a.right, b.right) };

    const candidates = [
      { x: b.right, y: rect.y, edge: 'left', guide: { axis: 'x', at: b.right, ...spanY } },
      { x: b.left - rect.w, y: rect.y, edge: 'right', guide: { axis: 'x', at: b.left, ...spanY } },
      { x: rect.x, y: b.bottom, edge: 'top', guide: { axis: 'y', at: b.bottom, ...spanX } },
      { x: rect.x, y: b.top - rect.h, edge: 'bottom', guide: { axis: 'y', at: b.top, ...spanX } },
    ];

    for (const c of candidates) {
      if (field && (c.x < field.left || c.y < field.top || c.x + rect.w > field.right || c.y + rect.h > field.bottom)) continue;
      const distance = Math.hypot(c.x - rect.x, c.y - rect.y);
      if (!best || distance < best.distance) best = { ...c, distance, docked: other.id };
    }
  }

  return best;
}

/* Two guides that describe the same line. The live preview asks every frame, and
   handing the desktop an equal guide as a new object re-renders everything that
   reads it sixty times a second for a line that has not moved. */
export const sameGuide = (p, n) =>
  p === n || (!!p && !!n && p.axis === n.axis && p.at === n.at && p.from === n.from && p.to === n.to);

/* The whole answer: where the window should come to rest, what it joined, and
   the line to draw while the hand is still moving. */
export function snapToNeighbors(rect, others = [], opts = {}) {
  const threshold = opts.threshold ?? SNAP_THRESHOLD;
  const align = opts.align ?? ALIGN_THRESHOLD;
  const a = rectOf(rect);
  const list = (others || []).filter(Boolean);

  const dropped = findOverlapJoin(a, rect, list, opts);
  if (dropped) {
    return { x: dropped.x, y: dropped.y, docked: dropped.docked, edge: dropped.edge, guide: dropped.guide };
  }

  const join = findJoin(a, rect, list, threshold, align);
  if (join) {
    return { x: join.x, y: join.y, docked: join.docked, edge: join.edge, guide: join.guide };
  }

  const line = findAlignment(a, rect, list, align);
  if (line) {
    return { x: line.x, y: line.y, docked: null, edge: null, guide: line.guide };
  }

  return { x: rect.x, y: rect.y, docked: null, edge: null, guide: null };
}