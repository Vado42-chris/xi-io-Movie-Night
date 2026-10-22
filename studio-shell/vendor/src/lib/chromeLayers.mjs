import { TRANSITION } from '@/lib/compoundSurface.mjs';

/* ── THE COMPOUND SURFACES THE SHELL ACTUALLY DRAWS ──────────────────────────
 *
 * Every band of chrome in the shell is a compound surface — a stack, not a box —
 * and every one of them consumes the same visibility primitive (see
 * src/lib/compoundSurface.mjs). This file is the DECLARATION of which ones exist
 * and which parts of the machine each one carries.
 *
 * ── WHY THE DECLARATION IS SEPARATE FROM THE MACHINE ────────────────────────
 *
 * The machine answers "what states may a compound surface be in, and what may be
 * done to one". It has no opinion about which surfaces there are. Keeping the
 * two apart is what lets a surface be added without touching the rules, and the
 * rules be tightened without touching a surface.
 *
 * ── WHAT EACH ENTRY DECLARES, AND WHY EACH FIELD IS EARNED ──────────────────
 *
 *   implements   the transitions this surface actually carries. A surface asked
 *                for one it does not list is REFUSED BY NAME rather than doing
 *                nothing, so a control that is absent is distinguishable from a
 *                control that is broken.
 *
 *   edge         where the surface stands, so its restore control is drawn on
 *                the edge the surface came from rather than in a corner the
 *                person has to be told about.
 *
 *   plain / why  Plain First: what it IS before what it is called.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 *
 * A surface that nothing renders is NOT declared. The estate already carries
 * dangling declarations — a surface named with nothing behind it — as a standing
 * finding, and adding more of them to a declaration file would be inventing the
 * defect this file is meant to end. The event rail, the layers panel, the
 * inspector and the Glass Box consume the SAME machine when they land; they are
 * not listed here until they do.
 *
 * ── AND THE TOOLKIT, WHICH IS THE INTERESTING CASE ──────────────────────────
 *
 * The right-hand drawer is a compound surface and it is declared here, because
 * it is the one that already carries the FULL set: it can be put away, collapsed
 * to its rail, brought back, pinned and unpinned. It was never a boolean — it was
 * the only one that was ever done properly — so it is the worked example the
 * other two are brought up to, rather than the exception the machine has to
 * accommodate.
 */

export const CHROME_LAYERS = [
    {
        id: 'top',
        label: 'Top bar',
        plain: 'The bar across the top',
        why: 'Search, the workspace, and the controls you reach for while working.',
        edge: 'top',
        /* No collapsed form. A 56px rail of a bar that is already one row is a
           second shape of the same thing, and inventing one would be a rail
           nothing draws. So the bar is visible or away, and it says so. */
        implements: [TRANSITION.HIDE, TRANSITION.SHOW],
    },
    {
        id: 'bottom',
        label: 'Taskbar',
        plain: 'The bar across the bottom',
        why: 'The dock, the start menu and the desk’s own footer. Putting it away gives the desk its bottom edge back.',
        edge: 'bottom',
        implements: [TRANSITION.HIDE, TRANSITION.SHOW],
    },
    {
        id: 'left',
        label: 'Conversation',
        plain: 'The chat column',
        why: 'The conversation, at whichever of its three depths you are answering at.',
        edge: 'left',
        /* ── IT RESTS AWAY, AND IS OPENED WHEN WANTED ────────────────────────
         *
         * This column was standing open on every visit, 340px of the desk given
         * to a conversation nobody had asked to see — and the floating chat,
         * which snaps to a window, a widget, a folder or a product, already
         * does that job. So the column is opt-in: the chip on the left edge
         * opens it, and the hide control inside it puts it away again. */
        rests: 'hidden',
        implements: [TRANSITION.HIDE, TRANSITION.SHOW],
    },
    {
        /* ── THE DESK'S OWN STATUS RAIL ──────────────────────────────────────
         *
         * This is a DIFFERENT surface from the toolkit below it, and it stands
         * on the same edge. It is declared separately because it was not
         * declared at all: DesktopRail mounted unconditionally and read no
         * visibility state, so the desk's clock, month, feed and owed list
         * could not be put away — and the icon field reserved 280px for them
         * forever, whether or not anything was standing there.
         *
         * That is the whole of "hard-coded panels preventing me from reaching
         * my icons". The panel was not pinned by a setting; it had no setting.
         *
         * HIDE and SHOW, like every other band that is drawn by the desk: it
         * has no collapsed form (a 56px rail of a status column is a second
         * shape of the same thing), so it is visible or away, and the way back
         * is drawn by ChromeRecovery on this edge. */
        id: 'desk-status',
        label: 'Desk status',
        plain: 'The desk’s right column',
        why: 'The time, the session, the month, what just happened and what is owed. Putting it away gives the desk its right edge back.',
        edge: 'right',
        /* Opt-in, for the same reason as the conversation column: 280px of the
           desk's right edge, open on every visit. The chip opens it. */
        rests: 'hidden',
        implements: [TRANSITION.HIDE, TRANSITION.SHOW],
    },
    {
        id: 'right',
        label: 'Toolkit',
        plain: 'The tool column',
        why: 'What this surface needs, what it runs, and the chest that is the same everywhere. It collapses to its rail, and it can be pinned open.',
        edge: 'right',
        /* ── WHY THERE IS NO HIDE HERE, AND IT IS NOT AN OMISSION ────────────
         *
         * Every other surface can be HIDDEN, which means absent — and a hidden
         * surface owes a way back, which is why it gets a recovery chip. The
         * drawer is the one that does not need one, because it HAS a collapsed
         * form: its rail. Collapsed, the drawer is still on screen as 56px of
         * itself, and its own handle and pin are inside that rail — so the
         * control that brings it back never left.
         *
         * Declaring HIDE for it would have been a state nothing writes, and a
         * recovery chip for a surface that never goes away is a control offering
         * to restore something that is already there. So the drawer carries the
         * four transitions it actually has, and says why it stops at four. */
        implements: [
            TRANSITION.COLLAPSE,
            TRANSITION.EXPAND,
            TRANSITION.PIN,
            TRANSITION.UNPIN,
        ],
    },
];

export const CHROME_LAYER_IDS = CHROME_LAYERS.map((layer) => layer.id);

/* A surface is looked up by id rather than by index, so a band added above is
   addressable the moment it lands and nothing holds a position. */
export const chromeLayer = (id) => CHROME_LAYERS.find((layer) => layer.id === id) || null;