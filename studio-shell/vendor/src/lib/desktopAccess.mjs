/* ── DESKTOP ACCESS · xiio.desktop-access/v1 ─────────────────────────────────
 *
 * HARD RULE, owner, 2026-10-03:
 *
 *     NO PANEL CAN EVER PERMANENTLY BLOCK A DESKTOP ICON.
 *
 * ── WHAT "PERMANENTLY" MEANS, AND WHY THAT WORD IS THE WHOLE RULE ───────────
 *
 * A panel that covers an icon is NOT a fault. Panels are the work and they
 * stand above the field; a window over an icon is a desktop being used. What is
 * refused is a panel that covers an icon and CANNOT BE GOT OUT OF THE WAY —
 * because then the icon is not covered, it is gone, and nothing on screen says
 * so.
 *
 * So the rule is not "panels must not overlap icons". It is:
 *
 *     EVERY PANEL MUST REMAIN DISMISSIBLE, WHICH MEANS ITS OWN CONTROLS MUST
 *     REMAIN ON THE FIELD.
 *
 * A panel whose header has been dragged past the edge has no grab and no close,
 * and it is exactly as unreachable as the icons underneath it. That is how a
 * panel becomes permanent: not by covering, but by being unable to stop.
 *
 * ── WHY THIS IS ARITHMETIC AND NOT A CHECK ──────────────────────────────────
 *
 * Bounding a drop is cheaper AND stronger than noticing a bad one. A panel that
 * can never come to rest outside the field can never be stranded — so there is
 * no stranded state to detect, no report to route, and no repair to perform.
 * The clamp below is therefore applied where the position is DECIDED (the drop)
 * rather than where it is drawn.
 *
 * The window frame and the pinned window were already held inside the field for
 * exactly this reason. A WIDGET was not — it was the one draggable surface in
 * the shell with no bounds at all, so it could be dragged until its own header,
 * and therefore its close control, was gone.
 *
 * Dependency-free and browser-safe: geometry, not a measurement. Nothing here
 * claims any panel has been observed on screen.
 */

export const SCHEMA = 'xiio.desktop-access/v1';

export const LAW = 'NO PANEL CAN EVER PERMANENTLY BLOCK A DESKTOP ICON';

/* The least of a panel that must stay on the field for the panel to be
   dismissible. Declared rather than inferred from whichever panel asked,
   because a panel that declared its own floor could declare zero — and a panel
   with a zero floor is one that can be dragged away from its own close. */
export const HEADER_FLOOR = 44;

/* Where a panel may come to rest: fully inside the field.
 *
 * An UNMEASURED field returns the position untouched, for the same reason
 * `panesFor` returns nothing for one — clamping against a field of unknown size
 * would place every panel at the origin, which is a worse fault than the one
 * being prevented. The desktop is measured before anything is dropped on it.
 *
 * A panel TALLER than the field is pinned to the top rather than pushed off it,
 * so its header stays visible and it stays dismissible. That is the whole point
 * of the clamp: the header is what makes a panel a panel and not a wall. */
export function clampToField(rect, field) {
  const width = Number(field?.width);
  const height = Number(field?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { x: rect.x, y: rect.y, clamped: false };
  }

  const maxX = Math.max(0, width - rect.w);
  const maxY = Math.max(0, height - rect.h);

  const x = Math.min(Math.max(rect.x, 0), maxX);
  const y = Math.min(Math.max(rect.y, 0), maxY);

  return { x, y, clamped: x !== rect.x || y !== rect.y };
}

export const NOT_CLAIMED = Object.freeze([
  'that every shell fixture has been classified as a panel or as furniture',
  'that a covered icon has been observed on screen — the reading is owed',
  'that a panel can never be moved by a keyboard shortcut outside this clamp',
]);