/**
 * THE MOTION CONTRACT — animation is part of the brand.
 *
 * THE TEMPO COMES FROM THE BACKGROUND. The cogwheel drifting behind everything
 * is the reference: it is smoothed, it is heavy, and it settles slowly. The
 * interface moves on that same beat, so the two read as one piece of music
 * rather than two unrelated ones.
 *
 * DepthBackground drives that motion, and two numbers are the whole story:
 *     time += 0.005 per frame
 *     current += (target - current) * 0.02 per frame
 * That second line is an exponential approach with a time constant of
 *     1 / (0.02 x 60) ≈ 0.83s
 * — roughly two and a half seconds to fully settle. Everything below is that
 * settle, subdivided. The background consumes these same constants, so there
 * is one tempo in the system, not two.
 */

export const TEMPO = {
  /* DepthBackground's frame step. Background-time advances 0.3/s at 60fps. */
  frameStep: 0.005,
  /* DepthBackground's parallax smoothing factor, applied per frame. */
  parallaxSmoothing: 0.02,
  /* The rate the ambient glow breathes at, in background-time. */
  ambientRate: 0.5,
  assumedFps: 60,
};

/* One full settle of the parallax, in seconds. The beat everything derives from. */
export const PARALLAX_SETTLE = 1 / (TEMPO.parallaxSmoothing * TEMPO.assumedFps); // ≈ 0.83s

/* One full breath of the ambient glow, in seconds. */
export const AMBIENT_BREATH =
  (2 * Math.PI) / (TEMPO.ambientRate * TEMPO.frameStep * TEMPO.assumedFps); // ≈ 42s

/* Milliseconds. The settle, subdivided. Mirrored in tailwind.config.js as
   duration-instant … duration-deliberate and in index.css as custom
   properties — the three declarations move together. */
export const DURATION = {
  instant: 120,      // settle / 8   — 104ms
  quick: 200,        // settle / 4   — 208ms
  base: 320,         // settle / 2.5 — 333ms
  settle: 480,       // settle / 1.7 — 490ms  ← the house default
  deliberate: 720,   // settle / 1.2 — 694ms
};

/* Seconds, for framer-motion. */
export const seconds = (ms) => ms / 1000;

/* Cubic-bezier control points. `out` is the bezier closest to the parallax's
   own exponential approach, which is why it is the house curve. */
export const EASE = {
  // Enters: fast out of the gate, long tail.
  out: [0.16, 1, 0.3, 1],
  // Reversible moves: leaving and returning.
  inOut: [0.65, 0, 0.35, 1],
  // Exits: leaves without lingering.
  in: [0.7, 0, 0.84, 0],
};

/* CSS equivalents, mirrored in index.css as custom properties. */
export const EASE_CSS = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  in: 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/* The beat. A surface does not arrive all at once — the shell lands, then the
   chrome, then the content, then the items inside it, each a step behind the
   last. */
export const STAGGER = {
  step: 60,
  shell: 0,
  chrome: 60,
  content: 120,
  items: 180,
};

/* Tuned to settle in roughly the parallax settle — the same heaviness, so an
   icon arriving and the cogwheel turning feel like the same hand. */
export const SPRING = { type: 'spring', stiffness: 200, damping: 28, mass: 1 };

/* The standard transition. It defaults to the settle beat, not the base beat:
   at the base beat things still arrive a touch sooner than the background
   moves, and that mismatch is what reads as jarring. Pass overrides rather
   than writing a new transition. */
export const transition = (overrides = {}) => ({
  duration: seconds(DURATION.settle),
  ease: EASE.out,
  ...overrides,
});

/* For the nth item in a set that lands together. The wave resolves at the
   deliberate beat rather than running on. */
export const stagger = (index, step = STAGGER.step) =>
  seconds(Math.min(index * step, DURATION.deliberate));