/* ── THE SHELL VISIBILITY PRIMITIVE ──────────────────────────────────────────
 *
 * Every compound surface — the taskbar, the conversation, the toolkit, the event
 * rail, the layers panel, the inspector, settings, the Glass Box — is the same
 * KIND of thing: a stack of chrome that can be put away and brought back. They
 * were not the same kind of thing in the code. Each panel decided its own
 * visibility, in its own component, with its own boolean, and the consequence
 * was exactly what a screenshot shows: a taskbar that can be hidden and never
 * unhidden, because the control that restores it lived inside the thing it was
 * restoring and left with it.
 *
 * ── THE INVARIANT, WHICH IS THE WHOLE POINT ─────────────────────────────────
 *
 *     HIDDEN_SURFACE ⇒ RESTORE_CONTROL_REMAINS_VISIBLE
 *
 * A person must never be able to put a surface away and thereby lose the control
 * needed to bring it back. That is not a styling rule and it is not a rule about
 * one panel. It is a property of the shell, so it is stated once here and every
 * surface inherits it: the restore control is drawn by the SHELL, at a band
 * above every surface, and never by the surface it restores.
 *
 * `restoreRequired` below is that invariant as a function. A surface that is
 * hidden owes a way back, and nothing may be hidden without one.
 *
 * ── THREE AXES, NOT ONE BOOLEAN ─────────────────────────────────────────────
 *
 * `visibility`  whether it is on screen at all, and in which of its forms
 * `placement`   whether it takes its space from the layout or floats over it
 * `attachment`  what it is bound to — the machine, this context, or a pin
 *
 * They are separate because they genuinely vary apart. A toolkit that is docked
 * and visible at one moment is floating and visible at the next without its
 * visibility having changed; a conversation that is pinned to a context is
 * visible in exactly the same way as one that is not. Collapsing them into one
 * enum is how a panel comes to lose its placement when it is merely hidden.
 *
 * ── WHAT A SURFACE MAY NOT PRETEND ──────────────────────────────────────────
 *
 * Not every surface implements every state, and that is honest rather than a
 * gap: the top bar has no collapsed form, and inventing one would be inventing
 * a rail nothing draws. So each surface DECLARES the transitions it carries, and
 * `canTransition` refuses the rest by name. A surface asked for a state it does
 * not implement answers "no, and here is why" rather than silently doing
 * nothing — which is the difference between a control that is absent and a
 * control that is broken.
 */

export const VISIBILITY = Object.freeze({
    VISIBLE: 'visible',
    COLLAPSED: 'collapsed',
    HIDDEN: 'hidden',
});

export const PLACEMENT = Object.freeze({
    DOCKED: 'docked',
    FLOATING: 'floating',
});

export const ATTACHMENT = Object.freeze({
    GLOBAL: 'global',
    CONTEXT: 'context',
    PINNED: 'pinned',
});

export const VISIBILITY_VALUES = Object.freeze(Object.values(VISIBILITY));
export const PLACEMENT_VALUES = Object.freeze(Object.values(PLACEMENT));
export const ATTACHMENT_VALUES = Object.freeze(Object.values(ATTACHMENT));

/* The three axes every surface's state is made of, and the value each one may
   hold. Declared as data so a caller validating a state and a form rendering it
   read the same list — a second copy of the permitted values is how a form comes
   to offer a state the machine refuses. */
export const SURFACE_AXES = Object.freeze([
    { id: 'visibility', values: VISIBILITY_VALUES, resting: VISIBILITY.VISIBLE },
    { id: 'placement', values: PLACEMENT_VALUES, resting: PLACEMENT.DOCKED },
    { id: 'attachment', values: ATTACHMENT_VALUES, resting: ATTACHMENT.CONTEXT },
]);

/* The transitions a surface may carry. A surface lists the ones it actually
   implements; everything else is refused by name rather than done silently. */
export const TRANSITION = Object.freeze({
    HIDE: 'hide',
    SHOW: 'show',
    COLLAPSE: 'collapse',
    EXPAND: 'expand',
    DOCK: 'dock',
    FLOAT: 'float',
    PIN: 'pin',
    UNPIN: 'unpin',
});

/* The state a surface rests in when nobody has said otherwise.
 *
 * VISIBLE, DOCKED and CONTEXT, in that order, and the direction matters: a
 * preference that fails to load leaves the shell with its chrome intact rather
 * than with a desk and no way to reach anything. Defaulting to hidden would make
 * a corrupt stored value indistinguishable from a deliberate choice, and the
 * cost of being wrong in that direction is a person unable to recover. */
export function restingState() {
    return {
        visibility: VISIBILITY.VISIBLE,
        placement: PLACEMENT.DOCKED,
        attachment: ATTACHMENT.CONTEXT,
    };
}

/* THE INVARIANT. A surface that is hidden owes a way back; a surface that is
   merely collapsed does not, because a collapsed surface is still on screen as
   its own rail — the control is inside the thing you can still see. */
export const restoreRequired = (visibility) => visibility === VISIBILITY.HIDDEN;

/* Whether a state is a state at all: every axis present, and every value one the
   axis permits. An unknown value is refused rather than coerced to a resting
   one, because coercing is how a surface ends up in a state nobody chose. */
export function isValidState(state) {
    if (!state || typeof state !== 'object') return false;
    return SURFACE_AXES.every((axis) => axis.values.includes(state[axis.id]));
}

/* ── APPLYING A TRANSITION ───────────────────────────────────────────────────
 *
 * Returns the next state, or a refusal that NAMES itself. The refusal carries
 * `first_red` in the estate's own idiom, so a surface that offers a control the
 * machine will not honour can say which one and why instead of appearing dead.
 *
 * `implements` is the surface's own declaration of the transitions it carries.
 * A transition it does not list is refused — this is the whole of "visibility
 * cannot be hard-coded by whichever component happened to implement the panel":
 * the panel does not decide, it declares, and the machine rules on it.
 */
export function applyTransition(state, transition, implements_) {
    const allowed = Array.isArray(implements_) ? implements_ : [];
    if (!allowed.includes(transition)) {
        return { ok: false, state, first_red: `SURFACE_DOES_NOT_IMPLEMENT_${String(transition).toUpperCase()}` };
    }

    const next = { ...state };

    switch (transition) {
        case TRANSITION.HIDE:
            next.visibility = VISIBILITY.HIDDEN;
            break;
        case TRANSITION.SHOW:
            /* SHOW restores the surface to its resting visible form. It does not
               try to restore the state it was in before it was hidden — that
               state is `placement` and `attachment`, which hiding never touched,
               so they are already what they were. */
            next.visibility = VISIBILITY.VISIBLE;
            break;
        case TRANSITION.COLLAPSE:
            next.visibility = VISIBILITY.COLLAPSED;
            break;
        case TRANSITION.EXPAND:
            next.visibility = VISIBILITY.VISIBLE;
            break;
        case TRANSITION.DOCK:
            next.placement = PLACEMENT.DOCKED;
            break;
        case TRANSITION.FLOAT:
            next.placement = PLACEMENT.FLOATING;
            break;
        case TRANSITION.PIN:
            next.attachment = ATTACHMENT.PINNED;
            break;
        case TRANSITION.UNPIN:
            /* Unpinning returns the surface to CONTEXT rather than to GLOBAL.
               A surface that was pinned to this context and then released is
               still about this context; sending it to the machine at large would
               be a second, larger change than the one that was asked for. */
            next.attachment = ATTACHMENT.CONTEXT;
            break;
        default:
            return { ok: false, state, first_red: 'UNKNOWN_TRANSITION' };
    }

    return { ok: true, state: next, transition };
}