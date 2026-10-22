/* ── WHAT IS ATTACHED TO A HOST, READ FROM THE CHILD'S OWN RECORD ────────────
 *
 * A widget dropped flush against a window records `docked_to: <host pane id>`
 * on itself (see WidgetBase / desktopSnap). That record IS the registration of
 * the child under the parent — the host does not keep a second list of its
 * children, because a second list is a second answer to "who is attached" and
 * the two would disagree the first time a widget was dragged away (which
 * replaces the child's record and so detaches it).
 *
 * This is the one place that question is asked, so the window header, and
 * anything that wants to list a host's tools later, read the same answer.
 *
 * A widget resolves to no structural node, so nothing here claims a revision
 * moved: the attachment is a desktop join, and it says so. */

export const JOIN_SOURCE = 'desktop.join';

/* Readable name for an attached widget. A stack or an unknown type still gets a
   name rather than an empty chip. */
const nameOf = (widget) =>
  String(widget?.title || widget?.type || widget?.id || 'tool').replace(/[-_]/g, ' ');

/** The widgets attached to `hostId`, each as { id, name, edge }. */
export function attachedTo(hostId, widgets = []) {
  if (!hostId || !Array.isArray(widgets)) return [];
  return widgets
    .filter((w) => w?.position?.docked_to === hostId)
    .map((w) => ({ id: w.id, name: nameOf(w), edge: w.position?.docked_edge || null }));
}

/** The sentence a join is filed under, derived from the same values. */
export function joinStatement({ child, host, edge }) {
  return `${child} joined ${host}${edge ? ` on its ${edge} edge` : ''}`;
}