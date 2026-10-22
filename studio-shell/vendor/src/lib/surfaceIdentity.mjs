/* ── ONE PANE, ONE IDENTITY · xiio.surface-identity/v1 ───────────────────────
 *
 * A pane has two names and it has them on every device:
 *
 *     CATEGORY   which family it belongs to — "SAM LAW", "ROOT", "HOME"
 *     TITLE      which pane this is       — "Dockets", "Console", "Studio"
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * navigationTaxonomy.jsx already states the law in its own words: "Mobile and
 * desktop must never author different category names for the same destination."
 * It states it, and then nothing enforces it, because there was nothing to
 * compare: the desktop window frame drew a TITLE and no category, and the phone
 * drew neither — it had a five-target tab bar and the page underneath.
 *
 * Two projections that never draw the same field cannot disagree about it. That
 * is not parity, it is absence, and it is why "category stew" was invisible: no
 * surface was reading a category at all.
 *
 * So the identity is resolved HERE, once, and both projections call it. They do
 * not each derive a category and then get compared — they call one function, so
 * a disagreement is not something to detect, it is something that cannot be
 * constructed. The comparison below exists to PROVE that, not to repair it.
 *
 * ── THIS IS A READING OF THE PANE CONTRACT, NOT A SECOND ONE ────────────────
 *
 * paneContract.PRIMITIVES.PROJECTION says a projection is "the SAME pane
 * wearing its other arrangement, never a second pane". This is what makes that
 * literally true rather than aspirational: the desktop window and the mobile
 * column are handed the same category and the same title, from the same source,
 * so they are the same pane by construction.
 *
 * ── AND A CATEGORY IS NEVER INVENTED ────────────────────────────────────────
 *
 * A surface that declares no category gets the ANCHOR it hangs from, because
 * that is a real declaration the registry already makes. A surface that is not
 * in the registry at all gets NO category — reported as CATEGORY_UNRESOLVED and
 * never rounded to a plausible one, because a pane wearing a category nobody
 * declared is exactly the stew this exists to remove.
 *
 * Dependency-free apart from the registry it reads. Nothing here claims any
 * pane has been observed on screen — that reading is in layoutVerification.mjs,
 * and it measures what was DRAWN against what is declared here. */

import { SURFACES, ANCHORS } from '@/components/framework/registry';

export const SCHEMA = 'xiio.surface-identity/v1';

export const LAW =
  'A PANE HAS ONE CATEGORY AND ONE TITLE, AND IT HAS THEM ON EVERY DEVICE';

/* Where a value came from, recorded rather than assumed — so a category that
   arrived from the anchor can be told apart from one somebody declared, which
   is the difference between a real answer and a lucky one. */
export const SOURCE = Object.freeze({
  DECLARED: 'DECLARED',
  SURFACE: 'SURFACE',
  ANCHOR: 'ANCHOR',
  NONE: 'NONE',
});

const surfaceById = (id) =>
  SURFACES.find((s) => s.id === id) || null;

/* The route a surface opens, as a path — "/Console". Used by the mobile column,
   which knows where it is and not which surface it is. */
export function surfaceIdForPath(pathname) {
  const route = String(pathname || '').replace(/^\//, '').split('?')[0];
  if (!route) return null;
  const match = SURFACES.find((s) => s.route === route);
  return match ? match.id : null;
}

/* ── THE RESOLUTION ──────────────────────────────────────────────────────────
 *
 * `surfaceId` names the pane. `category` and `title` are OVERRIDES, and they are
 * the two the frame legitimately needs: one window may be a pane called
 * "Dockets" inside the SAM LAW category, which is a fact about that window and
 * not about the surface it was opened from.
 *
 * A surface not found in the registry still answers — with the override it was
 * given, and with whatever it could not resolve named as unresolved. */
export function identityOf({ surfaceId = null, category = null, title = null } = {}) {
  const surface = surfaceId ? surfaceById(surfaceId) : null;
  const anchor = surface ? ANCHORS[surface.anchor] : null;

  const resolvedTitle = title ?? surface?.name ?? null;
  const resolvedCategory = category ?? surface?.category ?? anchor?.label ?? null;

  const categorySource = category != null ? SOURCE.DECLARED
    : surface?.category != null ? SOURCE.SURFACE
    : anchor?.label != null ? SOURCE.ANCHOR
    : SOURCE.NONE;

  const titleSource = title != null ? SOURCE.DECLARED
    : surface?.name != null ? SOURCE.SURFACE
    : SOURCE.NONE;

  const resolved = resolvedCategory != null && resolvedTitle != null;

  return {
    schema: SCHEMA,
    /* The ref is the pane's identity, not the surface's — a second window on
       the same surface is a second pane wearing the same category. Held by
       surface id so a projection can be matched back to what declared it. */
    ref: surface ? `pane:${surface.id}` : `pane:unknown:${resolvedTitle ?? 'unnamed'}`,
    surface_id: surface?.id ?? null,
    anchor: surface?.anchor ?? null,
    category: resolvedCategory,
    title: resolvedTitle,
    category_source: categorySource,
    title_source: titleSource,
    resolved,
    /* Absent is reported. A pane with no category is not a pane with a blank
       one, and the difference is the whole point of the field. */
    first_red: resolved ? null
      : resolvedCategory == null ? 'CATEGORY_UNRESOLVED'
      : 'TITLE_UNRESOLVED',
  };
}

/* The mobile column's own call. It knows where it is; this turns that into the
   same answer the desktop frame is handed. */
export function identityForPath(pathname, overrides = {}) {
  return identityOf({ surfaceId: surfaceIdForPath(pathname), ...overrides });
}

/* ── THE COMPARISON ──────────────────────────────────────────────────────────
 *
 * Both projections are built from one function, so this cannot fail by
 * construction — and that is precisely why it is worth running. It is the
 * executable statement of the claim, and it fails the moment somebody gives one
 * projection its own category: the second someone writes `category="Mobile"` in
 * the phone's header, this returns CATEGORY_DRIFT and names both values.
 *
 * It is the canary on the invariant, not the invariant itself. */
export function compareIdentity(desktop, mobile) {
  if (!desktop || !mobile) {
    return { ok: false, schema: SCHEMA, first_red: 'BOTH_PROJECTIONS_REQUIRED' };
  }
  const diffs = [];
  if (desktop.category !== mobile.category) {
    diffs.push({ field: 'category', desktop: desktop.category, mobile: mobile.category });
  }
  if (desktop.title !== mobile.title) {
    diffs.push({ field: 'title', desktop: desktop.title, mobile: mobile.title });
  }
  if (!diffs.length) {
    return {
      ok: true,
      schema: SCHEMA,
      ref: desktop.ref,
      category: desktop.category,
      title: desktop.title,
    };
  }
  return {
    ok: false,
    schema: SCHEMA,
    ref: desktop.ref,
    first_red: diffs[0].field === 'category' ? 'CATEGORY_DRIFT' : 'TITLE_DRIFT',
    detail: 'the two projections authored different names for one pane',
    diffs,
  };
}

/* The proof, run over every surface the registry declares: project each one as
   the desktop frame would and as the mobile column would, and compare. Counts
   are returned rather than a bare verdict, because "17 of 17 held" is a reading
   and "held" is a claim. */
export function parityCensus() {
  const rows = SURFACES.map((surface) => {
    const desktop = identityOf({ surfaceId: surface.id });
    const mobile = identityForPath(`/${surface.route}`);
    return {
      surface_id: surface.id,
      route: surface.route,
      category: desktop.category,
      title: desktop.title,
      category_source: desktop.category_source,
      reading: compareIdentity(desktop, mobile),
    };
  });

  const drifted = rows.filter((r) => !r.reading.ok);
  const unclassified = rows.filter((r) => !r.resolved);

  return {
    schema: SCHEMA,
    law: LAW,
    rows,
    total: rows.length,
    held: rows.length - drifted.length,
    drifted: drifted.length,
    unclassified: unclassified.length,
    state: drifted.length ? 'PARITY_DRIFTED' : 'PARITY_HELD',
    first_red: drifted.length
      ? drifted[0].reading.first_red
      : unclassified.length
        ? 'CATEGORY_UNRESOLVED'
        : null,
    owed: drifted.length
      ? `${drifted.length} pane(s) resolve differently as a desktop window and as a mobile column`
      : unclassified.length
        ? `${unclassified.length} surface(s) declare no category — they are named as unresolved rather than given one`
        : null,
  };
}