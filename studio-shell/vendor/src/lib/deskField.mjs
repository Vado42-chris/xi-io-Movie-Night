/* ── THE DESK'S OCCUPANCY · xiio.desk-field/v1 ───────────────────────────────
 *
 * ONE ANSWER TO "IS THIS GROUND TAKEN?"
 *
 * The desk had five things that put a rectangle on the field — the icon
 * formation, widgets, seam readouts, pinned panes and open windows — and each
 * one asked its own question before it stood somewhere:
 *
 *   icons      "is this slot free of other icons, and of a window or a pin?"
 *   widgets    "is this cell free of other widgets?"
 *   readouts   nothing; a hardcoded cascade
 *
 * Nobody asked the question across kinds, so the factory clock was laid down on
 * the first three rows of the formation and both looked correct to the code that
 * placed them. That is not five bugs, it is one missing rule: a rect is only
 * free if NOTHING on the field holds it.
 *
 * This file is that rule, as pure geometry. It owns no state and reads no DOM,
 * so the grid, the seam layer and anything added later ask the same function the
 * same question and cannot disagree about the answer.
 *
 * A rect here is { x, y, w, h } in the FIELD's own coordinates. An obstacle is a
 * rect that may be carried an `id` and a `kind` for the reader; neither is
 * load-bearing. */

export const SCHEMA = 'xiio.desk-field/v1';

export const LAW = 'A RECT IS FREE ONLY IF NOTHING ON THE FIELD HOLDS IT';

/* Touching is not overlapping. Two cells share an edge on a lattice by
   construction, and a strict comparison is what lets them. */
export const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const overlapsAny = (rect, list = []) => list.some((other) => rectsOverlap(rect, other));

/* Two obstacle lists that describe the same ground. The icons republish on every
   render of the desk, and handing the grid an equal list as a new array would
   re-render every widget for a field that has not moved. */
export const sameRects = (a = [], b = []) =>
    a === b || (
        a.length === b.length &&
        a.every((r, i) => r.id === b[i].id && r.x === b[i].x && r.y === b[i].y && r.w === b[i].w && r.h === b[i].h)
    );

/* ── THE NEAREST FREE CELL ───────────────────────────────────────────────────
 *
 * Every lattice cell inside `bounds` whose footprint clears every obstacle, and
 * the one closest to `from`. Nearest rather than first, because the drop is a
 * gesture: a widget let go over the icons should land in the free cell beside
 * where the hand was, not at the top-left of the desk. Ties go to the lower x
 * and then the lower y, so the answer is the same every time it is asked.
 *
 * `bounds` is the range of TOP-LEFT positions the footprint may take, which is
 * the field less the footprint itself. The field is a few hundred cells, so this
 * is a scan and not a search. Returns null when nothing is free — the caller
 * decides what a full desk does, and this never pretends. */
export function nearestFreeCell({ footprint, obstacles = [], from, origin, unit, bounds }) {
    if (!footprint || !from || !origin || !unit || !bounds) return null;

    const firstCol = Math.ceil((bounds.minX - origin.x) / unit);
    const lastCol = Math.floor((bounds.maxX - origin.x) / unit);
    const firstRow = Math.ceil((bounds.minY - origin.y) / unit);
    const lastRow = Math.floor((bounds.maxY - origin.y) / unit);

    let best = null;
    for (let col = firstCol; col <= lastCol; col += 1) {
        for (let row = firstRow; row <= lastRow; row += 1) {
            const x = origin.x + col * unit;
            const y = origin.y + row * unit;
            if (overlapsAny({ x, y, w: footprint.w, h: footprint.h }, obstacles)) continue;

            const distance = Math.hypot(x - from.x, y - from.y);
            if (
                !best ||
                distance < best.distance ||
                (distance === best.distance && (x < best.x || (x === best.x && y < best.y)))
            ) {
                best = { x, y, distance };
            }
        }
    }

    return best ? { x: best.x, y: best.y } : null;
}