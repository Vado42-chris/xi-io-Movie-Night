import { TEMPO } from './motion.js';

/* THE @IBAL PANEL SHADOW — the one soft light in the shell.
 *
 * Every soft light in this interface is the same shadow: the one cast behind
 * the @IBAL panel. Offset 0, blur 50px, spread -10px, weight 0.2.
 *
 * THE LIGHT MIRRORS THE SHADOW, exactly. It travels as far as the shadow
 * travels, and it is as bright at a given distance as the shadow is dark at
 * that same distance, because it is the same curve read the other way up. The
 * shadow's numbers are the light's numbers.
 *
 * There is no reach factor and no heat factor. Those are what broke it before:
 * the light had multipliers the shadow did not, so the two stopped describing
 * the same thing. Do not add one back.
 */
export const IBAL_PANEL_SHADOW = {
  blur: 50,
  spread: -10,
  alpha: 0.2,
};

/* THE LIGHT REACHES THE FOUR CORNERS.
 *
 * X·I over I·O — one field, four corners, the light giving up exactly where the
 * mark is drawn. Its rim is not a radius that anyone chose: it is the corners,
 * so the reach is measured from wherever the light is standing, and it is
 * always far enough to touch all four. The blur still says how the light
 * behaves on the way out; the field says how far out is.
 */
export const cornerReach = (x, y, width, height) =>
  Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y),
  );

/* The shadow's falloff, sampled at seven points. A blurred edge holds its value
   through the middle and gives up only at the rim — it does not fade evenly,
   and neither does the light. Read as light, this is why the glow stays bright
   well out from the cursor instead of dying at its feet. */
export const SHADOW_PROFILE = [
  [0.00, 1.00],
  [0.20, 0.98],
  [0.40, 0.92],
  [0.60, 0.78],
  [0.80, 0.50],
  [0.90, 0.28],
  [1.00, 0.00],
];

/* The shadow is black; its mirror is the brand's fire. */
const FIRE_RAMP = [
  '255, 248, 232',
  '255, 214, 150',
  '255, 170, 70',
  '255, 120, 32',
  '210, 72, 16',
  '160, 44, 8',
  '160, 44, 8',
];

/* The light as colour stops. `core` is the shadow's own weight — stacked when
   an open app lays a second shadow layer over the first, because stacked layers
   deepen. That is the only thing that is ever multiplied in. */
/* ── THE FALLOFF IS A SETTING, NOT A CONSTANT ────────────────────────────────
 *
 * The shadow's own profile holds near full strength out to ~60% of the reach
 * and then drops away at a steady slope that is still steep when it arrives at
 * the rim. Measured, not guessed: half-strength sits at 80% of the radius and
 * the slope at the rim is 2.8. That is a lamp with an edge, and an edge is
 * exactly what a person can point at and call hard.
 *
 * So the layer carries a SOFTNESS, and this is what it means. 0 is the shadow's
 * own profile, stop for stop — the brand reading, kept so nobody has to lose it
 * to get the other. 1 is a bell: it leaves the hand immediately, has no plateau,
 * and arrives at the rim with a slope of zero, so there is no place in it where
 * the light "stops". In between is a straight blend of the two curves.
 *
 * The bell is a Gaussian pulled down to exactly zero at the rim and then
 * windowed over the last 45% with a smoothstep. The subtraction alone would
 * leave a residual slope at the rim; the window is what takes it to zero. */
const shadowWeight = (t) => {
  for (let i = 1; i < SHADOW_PROFILE.length; i++) {
    const [t1, w1] = SHADOW_PROFILE[i - 1];
    const [t2, w2] = SHADOW_PROFILE[i];
    if (t <= t2) return w1 + (w2 - w1) * ((t - t1) / (t2 - t1));
  }
  return 0;
};

const smoothstep = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const BELL = 3.2;
const BELL_FLOOR = Math.exp(-BELL);
const bellWeight = (t) =>
  ((Math.exp(-BELL * t * t) - BELL_FLOOR) / (1 - BELL_FLOOR)) * (1 - smoothstep(0.55, 1, t));

const FIRE_SAMPLES = 16;

/* The light's strength (0..1 of its core) at each sampled distance (0..1 of its
   reach). This is the ONE curve: the field paints it on a canvas and the cursor
   paints it in the DOM, both from here, so they cannot drift into two lights. */
export const fireProfile = (softness = 0) => {
  const s = Math.min(1, Math.max(0, Number.isFinite(softness) ? softness : 0));
  /* At 0 the stops are the shadow's own seven, so the brand reading is exact
     rather than approximated by a resample. */
  const at = s === 0
    ? SHADOW_PROFILE.map(([t]) => t)
    : Array.from({ length: FIRE_SAMPLES + 1 }, (_, i) => i / FIRE_SAMPLES);
  return at.map((t) => [t, shadowWeight(t) * (1 - s) + bellWeight(t) * s]);
};

const FIRE_RGB = FIRE_RAMP.map((c) => c.split(',').map(Number));

/* The ramp's colour at any distance, interpolated between its seven stops — the
   softer profiles sample more points than the ramp has colours. */
const rampRgb = (t) => {
  for (let i = 1; i < SHADOW_PROFILE.length; i++) {
    const t1 = SHADOW_PROFILE[i - 1][0];
    const t2 = SHADOW_PROFILE[i][0];
    if (t <= t2) {
      const u = t2 === t1 ? 0 : (t - t1) / (t2 - t1);
      return FIRE_RGB[i - 1].map((c, k) => Math.round(c + (FIRE_RGB[i][k] - c) * u));
    }
  }
  return FIRE_RGB[FIRE_RGB.length - 1];
};

export const fireStops = (core, softness = 0) =>
  fireProfile(softness).map(([stop, weight]) => [
    stop,
    `rgba(${rampRgb(stop).join(', ')}, ${(core * weight).toFixed(4)})`,
  ]);

export const LAYERS = { rest: 1, open: 2 };

/* ── THE WINDOW'S OWN LIGHT ────────────────────────────────────────────────
 *
 * The ramp above is one fixed fire, and every window in the shell burned the
 * same amber whatever it was — a blue window and a red one lit the desktop
 * identically, so the light never belonged to the thing it was lighting. This
 * is the same curve, given the window's own hue.
 *
 * It is sunlight rather than a tint: a near-white core, the hue at full
 * strength through the body, and the hue's own shadow at the rim. Nothing is
 * desaturated to make it polite — the middle of the ramp is where the colour
 * lives, and that is the part you actually see, because the blend is screen.
 */
/* ── THE HUE TABLE, AND THE ONE COLOUR THAT WAS MISSING FROM IT ─────────────
 *
 * Every entry here is a hue a window can be lit by. The list is Tailwind's own
 * palette, and the estate's one owned colour was NOT in it — the rail's biggest
 * anchor declares `colour: 'brand'`, which resolved to no hue at all and fell
 * through to the system grey in `accentCss`.
 *
 * So thirteen surfaces — Gateway, Overview, Analytics, CRM, Comms, Commerce,
 * Finance, Archives, Legal, Case Studies, Bins and the rest of ROOT — opened
 * grey. Not a colour anybody chose: the fallback, worn by the anchor the estate
 * is drawn around, in the one place the brand is supposed to be stated.
 *
 * 168 is `--color-brand`'s hue, declared in index.css. A hue table is where a
 * hue is stated, so it is stated here as well rather than left to the
 * coincidence that the fallback happens to be teal-ish. */
const THEME_HUE = {
  brand: 168,
  red: 0, orange: 25, amber: 38, yellow: 48, lime: 82, green: 140,
  emerald: 160, teal: 172, cyan: 188, sky: 200, blue: 218, indigo: 245,
  violet: 262, purple: 275, fuchsia: 292, pink: 330, rose: 350,
};

const hslToRgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

/* Lightness and saturation at each of the shadow's seven stops. The core is
   almost white; the rim is the same hue at a third of the light. */
const SUNLIGHT = [
  [96, 52], [86, 78], [74, 92], [62, 96], [50, 94], [38, 88], [30, 82],
];

export const themeHue = (theme) => {
  const name = String(theme || '').split('-')[0];
  return Object.prototype.hasOwnProperty.call(THEME_HUE, name) ? THEME_HUE[name] : null;
};

/* The window's light, off the shadow's curve, in the window's own colour. A
   theme with no hue — a system grey — keeps the brand fire, because a grey
   light is not a light. */
export const fireStopsFor = (theme, core) => {
  const hue = themeHue(theme);
  return SHADOW_PROFILE.map(([stop, weight], i) => {
    if (hue == null) return [stop, `rgba(${FIRE_RAMP[i]}, ${(core * weight).toFixed(4)})`];
    const [l, s] = SUNLIGHT[i];
    const [r, g, b] = hslToRgb(hue, s, l);
    return [stop, `rgba(${r}, ${g}, ${b}, ${(core * weight).toFixed(4)})`];
  });
};

/* The same colour at rest — for the frame's border and the rail's tint, so a
   window's edge and its light are one identity rather than two. */
export const accentCss = (theme, alpha = 0.45) => {
  const hue = themeHue(theme);
  const [r, g, b] = hue == null ? [148, 148, 152] : hslToRgb(hue, 74, 60);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* The flame's pulse, in background-time — one slow breath and one fast tremor,
   so it reads as fire and not as a lamp. Shared, so the light behind the glass
   and the light in front of it are one flame rather than two. */
export const fireFlicker = (time) =>
  0.86 + Math.sin(time * 2.3) * 0.09 + Math.sin(time * 5.7) * 0.05;

/* Background-time from a single epoch, so every flame in the shell is in phase.
   DepthBackground advances its own clock by frames x frameStep at 60fps, which
   is elapsed seconds x 0.3 — the same number, read from a shared start. */
const EPOCH = typeof performance !== 'undefined' ? performance.now() : Date.now();
export const backgroundTime = () =>
  ((performance.now() - EPOCH) / 1000) * TEMPO.frameStep * TEMPO.assumedFps;