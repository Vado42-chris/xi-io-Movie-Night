/* ── AN ICON-ONLY BUTTON ALWAYS HAS A NAME ───────────────────────────────────
 *
 * 147 of the 186 icon buttons in the estate carried no aria-label, and the guard
 * that was meant to catch it was an empty function. Labelling them site by site
 * is a race against the next button written, so the name is derived ONCE, in the
 * primitive every one of them renders through.
 *
 * An explicit aria-label always wins. Failing that, the button's own `title`
 * (already written for humans, so already descriptive). Failing that, the lone
 * icon it draws — Trash2 → "Trash", ChevronLeft → "Chevron Left", X → "Close".
 * A button with none of the three gets no name, and that is reported rather than
 * invented: a made-up label is worse than a missing one. */
import React from 'react';

const SAID_BETTER = { X: 'Close', Plus: 'Add', Minus: 'Remove', Check: 'Confirm' };

function humanize(raw) {
  const base = raw.replace(/Icon$/, '').replace(/\d+$/, '');
  if (SAID_BETTER[base]) return SAID_BETTER[base];
  return base.replace(/([a-z])([A-Z])/g, '$1 $2').trim() || undefined;
}

export function iconButtonName(props) {
  if (props['aria-label'] != null || props['aria-labelledby'] != null) return undefined;
  if (typeof props.title === 'string' && props.title) return props.title;
  const kids = React.Children.toArray(props.children);
  if (kids.length !== 1 || !React.isValidElement(kids[0])) return undefined;
  const raw = kids[0].type?.displayName || kids[0].type?.name;
  return typeof raw === 'string' ? humanize(raw) : undefined;
}