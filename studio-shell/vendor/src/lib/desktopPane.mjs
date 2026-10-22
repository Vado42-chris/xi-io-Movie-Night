/* ── THE DRAWER IS A PANE · xiio.desktop-pane/v1 ─────────────────────────────
 *
 * Owner law, 2026-10-01:
 *
 *     "Your drawer you attach to this project in mobile is just another window
 *      pane that needs to snap in desktop view with the chats — this gives you
 *      access in both views."
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 * The drawer was built as SHELL FURNITURE: a column bolted to the right edge of
 * the layout, outside the desktop entirely. The desktop's snap maths ran over
 * `pinnedItems` — the pinned chats and windows — and the drawer was not in that
 * list, so it could not be joined. A chat dragged toward it came to rest
 * wherever the lattice put it, and the two panels that were obviously one
 * workstation could never be brought flush.
 *
 * That is not a missing feature. It is a CATEGORY ERROR: the drawer was treated
 * as a different KIND of thing from a chat window, when the only thing that
 * differs between them is which edge of the screen they were assigned.
 *
 * ── THE LAW ─────────────────────────────────────────────────────────────────
 *
 *     A PANE IS ANYTHING THAT OCCUPIES A RECT ON THE DESKTOP AND MAY BE JOINED.
 *
 * A pane is not a widget, not a window, not a drawer. Those are ARRANGEMENTS a
 * pane is shown in — and the arrangement is the only thing a viewport changes:
 *
 *     DESKTOP   the drawer is a COLUMN, the chat is a WINDOW
 *     MOBILE    both are OVERLAYS on the one screen
 *
 * Same pane, same identity, same membership of the snap set. That is what makes
 * it accessible in both views without being built twice — and it is why this
 * file exists rather than a second drawer being written for the phone.
 *
 * ── WHY THE DRAWER'S RECT NEEDS NO MEASUREMENT ──────────────────────────────
 *
 * The drawer sits immediately OUTSIDE the desktop field, against its right
 * edge. So its left edge IS the field's right edge — `field.width` — and no
 * bounding rect, no ResizeObserver and no published width is required to know
 * where it is. The join maths only reads `b.left` to bring a window flush to a
 * neighbour's edge, so the pane's own width is declared for honesty and is not
 * load-bearing.
 *
 * A pane whose rect had to be measured would be a pane that was missing for the
 * first frame after every resize, and a snap that works only once the layout
 * has settled is a snap that feels broken.
 *
 * ── WHAT IS REFUSED ─────────────────────────────────────────────────────────
 *
 *   · A PANE IS NOT A SECOND SNAP SYSTEM. It is an entry in the list
 *     `snapToNeighbors` already takes (src/lib/desktopSnap.mjs). A drawer with
 *     its own snapping would be a drawer that joins differently from a chat,
 *     which is the category error this file exists to undo.
 *
 *   · THE DRAWER IS NOT DRAGGABLE. Being a pane makes it JOINABLE, not mobile.
 *     A chat snaps to the drawer's edge; the drawer does not follow the chat
 *     around. Shell furniture that wandered would be the shell taking the
 *     display, which is the thing this estate keeps removing.
 *
 * Dependency-free and browser-safe: geometry, not a measurement. Nothing here
 * claims any pane has been observed on screen. */

export const SCHEMA = 'xiio.desktop-pane/v1';

export const LAW = 'A PANE IS ANYTHING THAT OCCUPIES A RECT ON THE DESKTOP AND MAY BE JOINED';

/* The arrangements. A viewport changes WHICH one a pane is shown in, and never
   which pane it is. */
export const ARRANGEMENT = Object.freeze({
    DESKTOP: 'COLUMN_OR_WINDOW',
    MOBILE: 'OVERLAY',
});

export function arrangementFor(device) {
    return device === 'MOBILE' ? ARRANGEMENT.MOBILE : ARRANGEMENT.DESKTOP;
}

export const DRAWER_PANE_ID = 'xiio:pane:tool-drawer';
export const CHAT_PANE_ID = 'xiio:pane:desktop-chat';

export const SEMANTIC_Z = Object.freeze({
    WORK: 'Z0_WORK',
    CONTEXT: 'Z1_CONTEXT',
    TOOLS: 'Z2_TOOLS_SETTINGS',
    LOOKING_GLASS: 'Z3_LOOKING_GLASS',
    FORECAST: 'Z4_FORECAST',
    TRANSIENT: 'Z5_TRANSIENT',
});

export const WIDGET_FOOTPRINTS = Object.freeze({
    sm: { w: 256, h: 128 },
    md: { w: 320, h: 256 },
    lg: { w: 384, h: 384 },
    xl: { w: 500, h: 400 },
});

/* One default footprint for an ordinary application window.
 *
 * WindowFrame used to render 1000×700 while DesktopEnvironment published a
 * freshly-opened window to the snap registry as 0×0 until the first geometry
 * callback. A visible pane and its snap rect are one occurrence, so there is
 * one declared footprint and both consumers read it. */
export const DEFAULT_WINDOW_FOOTPRINT = Object.freeze({ w: 1000, h: 700 });

export function paneFromWidget(widget = {}) {
    const fallback = WIDGET_FOOTPRINTS[widget.size] || WIDGET_FOOTPRINTS.md;
    return {
        id: widget.id,
        kind: 'widget',
        x: Number(widget.position?.x ?? 0),
        y: Number(widget.position?.y ?? 0),
        w: Number(widget.w ?? fallback.w),
        h: Number(widget.h ?? fallback.h),
        x_ref: widget.x_ref || null,
        semantic_z: widget.semantic_z || SEMANTIC_Z.WORK,
        joinable: true,
        draggable: widget.locked !== true,
    };
}

/* The drawer, as the snap maths needs to see it.
 *
 * `x` is the field's own width — the drawer's left edge is the field's right
 * edge — and `h` is the field's height, so a window sharing the drawer's
 * vertical band is treated as sharing ground with it and is pulled flush.
 *
 * Returns an EMPTY LIST when the field has not been measured. A pane placed
 * against a field of unknown size would be a pane at the origin, and every
 * window dragged near the left edge would join a drawer that is on the right. */
export function panesFor({ field, chrome = {}, chatWidth = 340 } = {}) {
    const width = Number(field?.width);
    const height = Number(field?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];

    const out = [];

    if (chrome.left !== false) {
        out.push({
            id: CHAT_PANE_ID,
            kind: 'chat',
            x: 0,
            y: 0,
            w: chatWidth,
            h: height,
            x_ref: null,
            semantic_z: SEMANTIC_Z.WORK,
            joinable: true,
            draggable: false,
        });
    }

    if (chrome.right !== false) {
        out.push({
            id: DRAWER_PANE_ID,
            kind: 'drawer',
            x: width,
            y: 0,
            w: 0,
            h: height,
            x_ref: null,
            semantic_z: SEMANTIC_Z.TOOLS,
            joinable: true,
            draggable: false,
        });
    }

    return out;
}

export const NOT_CLAIMED = Object.freeze([
    'that the drawer has been observed on screen as a pane — the reading is owed',
    'that every shell fixture has been classified as a pane or as furniture',
    'that a chat window joins the drawer on a phone — there is no field to join against there',
]);