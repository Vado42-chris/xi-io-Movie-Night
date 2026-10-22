import React, { createContext, useContext, useMemo, useState } from 'react';

/* ── THE LINE A WINDOW IS ABOUT TO LAND ON, KEPT OFF THE DESK'S OWN CONTEXT ──
 *
 * The guide is written on every drag frame, and it CHANGES several times inside
 * one drag: it appears as the hand comes near a neighbour, it moves with the
 * join, and it goes when the hand leaves. It used to be state on the grid
 * provider, so each of those changes re-rendered the provider, rebuilt its
 * context value — a fresh object literal, so every consumer saw a change — and
 * re-rendered every window, the whole application inside each one, every
 * widget, the icon grid and the desktop that holds them. A drag therefore
 * stuttered at exactly the moments it was supposed to feel like the window was
 * finding an edge.
 *
 * TWO CONTEXTS, and that is the whole point of this file:
 *
 *   · the SETTER is built once and never changes identity, so a surface that
 *     only ever WRITES a guide — every window, every widget, every pin —
 *     subscribes to nothing that moves and never re-renders because of it;
 *   · the VALUE is read by one leaf, SnapGuides, whose entire job is to draw
 *     one line.
 *
 * A guide is a drawing of an intention. Nothing else in the estate has any
 * business re-rendering because the intention moved.
 *
 * Mounted ABOVE the grid provider (see src/Layout.jsx) so the grid provider can
 * take the setter without taking the value — and `children` is the same element
 * the parent already built, so when the guide changes React bails out of the
 * subtree and only the leaf that reads it re-renders. */

const SnapGuideSetterContext = createContext({ setGuide: () => {} });
const SnapGuideValueContext = createContext(null);

export function SnapGuideProvider({ children }) {
  const [guide, setGuide] = useState(null);

  /* `setGuide` is a state setter: stable for the life of the provider. The
     wrapper object is therefore built once, and never re-created. */
  const setter = useMemo(() => ({ setGuide }), []);

  return (
    <SnapGuideSetterContext.Provider value={setter}>
      <SnapGuideValueContext.Provider value={guide}>
        {children}
      </SnapGuideValueContext.Provider>
    </SnapGuideSetterContext.Provider>
  );
}

/** Write a guide. Never causes a re-render — the identity never changes. */
export function useSnapGuideSetter() {
  return useContext(SnapGuideSetterContext);
}

/** Read the guide. Only the surface that DRAWS it should call this. */
export function useSnapGuideValue() {
  return useContext(SnapGuideValueContext);
}