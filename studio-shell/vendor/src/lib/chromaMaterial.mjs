/* ── THE CHROMA WRAPPER · xiio.chroma-material/v1 ────────────────────────────
 *
 * SHADOW, GLOSS AND REFLECTION ARE ONE THING SEEN THREE WAYS.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The estate could already prove its luminance ladder was DECLARED correctly:
 * shadingCanary measures the blend, the knockout and the collisions, in both
 * readings. And it says of itself, in its own words, that it "cannot prove a
 * given surface applied it".
 *
 * That is the half that was missing. A coloured window could carry a hue and be
 * lit by nothing — a flat plate with a border, in BOTH readings, with every
 * declaration green. The canary was right: the ladder was fine and the surface
 * was unlit.
 *
 * So this is the other half. One material, on a coloured surface, giving it all
 * three of the things light does to a body:
 *
 *   SHADOW      where the light did not reach
 *   GLOSS       where the light lands first
 *   REFLECTION  the colour the surface gives back
 *
 * ── THE TWO READINGS ARE NOT TWO DESIGNS ────────────────────────────────────
 *
 * Both get all three. What changes is which one LEADS:
 *
 *   DARK    leads with REFLECTION — the glow shining through from the pointer.
 *           A shadow on a near-black field is very nearly invisible, so the
 *           light that is THERE is what separates two surfaces.
 *   LIGHT   leads with SHADOW — the construction-paper lift. A white glow on a
 *           white field is very nearly invisible, so the light that is MISSING
 *           is what separates them.
 *
 * The gloss is the same in both, because it is the same light falling from the
 * same place. Only how much of it the surface gives back changes.
 *
 * ── ONE HUE, READ FROM ITS OWNER ────────────────────────────────────────────
 *
 * The hue is NOT declared here. It is read from panelShadow's THEME_HUE, which
 * is where a window's light already comes from — so a window's glow, its edge
 * and its chroma wrapper are one identity rather than three that agree by hand.
 *
 * A theme with no hue keeps the brand teal, for the same reason fireStopsFor
 * does: a grey light is not a light.
 *
 * ── WHAT THIS FILE DOES NOT DO ──────────────────────────────────────────────
 *
 * It does not decide how bright the gloss is, or how deep the shadow. Those are
 * the STYLESHEET's, per reading — a component that also chose them would be a
 * second answer to a question the mode already answers, and the two would drift
 * the first time one was tuned.
 *
 * It hands over ONE value: the hue. Everything else is `.xi-chroma`. */

import { themeHue } from './panelShadow.js';

export const SCHEMA = 'xiio.chroma-material/v1';

export const LAW = 'A COLOURED SURFACE IS LIT, NOT FILLED';

/* The three, named, so a reading can ask which of them a surface actually has.
   A surface with a hue and no shadow has been COLOURED, not lit — and the two
   look identical in a screenshot taken at the wrong moment. */
export const TRINITY = Object.freeze([
  Object.freeze({ id: 'shadow', says: 'where the light did not reach' }),
  Object.freeze({ id: 'gloss', says: 'where the light lands first' }),
  Object.freeze({ id: 'reflection', says: 'the colour the surface gives back' }),
]);

/* The brand's own hue — the fallback for a surface that declares no colour. */
export const BRAND_HUE = 168;

/* The class that draws the trinity. Declared here so the stylesheet and the
   component cannot come apart on the spelling. */
export const CHROMA_CLASS = 'xi-chroma';

/* ── THE LIT CLASS, AND WHO WEARS IT ─────────────────────────────────────────
 *
 * A theme that declares a hue is a COLOURED surface. A system grey declares
 * none. That distinction is already made by `themeHue` — the owner of a window's
 * light — so it is read from there rather than decided a second time here.
 *
 * It matters because the two are not the same object on the desk:
 *
 *   NEUTRAL CHROME  is SET INTO the desktop — a well cut in the surface, read
 *                   from its walls. See src/components/desktop/embedded.css.
 *   COLOURED        stands ABOVE the field and is LIT — shadow under it, gloss
 *                   on its top edge, its own hue given back at the foot.
 *
 * The well used to be drawn over BOTH. A coloured window therefore got an
 * all-inset box-shadow, so it cast no shadow at all, under a black inset wash
 * deep enough to flatten the ladder its own content sits on. That is a surface
 * that is neither lit nor set in — a muddy plate — and it is why the coloured
 * windows were unreadable with every declaration green. */
export const LIT_CLASS = 'xi-chroma-lit';

export function isColoured(theme) {
  return themeHue(theme) != null;
}

/* The hue a surface is lit by, or the brand's when it declares none. */
export function hueFor(theme) {
  const hue = themeHue(theme);
  return hue == null ? BRAND_HUE : hue;
}

/* The class string a surface wears. Kept beside CHROMA_CLASS so a surface cannot
   take the material and forget which of the two objects it is. */
export function chromaClass(theme, extra = '') {
  return [CHROMA_CLASS, isColoured(theme) ? LIT_CLASS : '', extra].filter(Boolean).join(' ');
}

/* The one custom property the material reads, merged over any style the caller
   already had — a window carries its border colour on the same object, and
   replacing that object would drop the border. */
export function chromaStyle(theme, extra) {
  return { '--chroma-hue': String(hueFor(theme)), ...(extra || {}) };
}