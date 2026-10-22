/**
 * PROJECTION — one sovereign environment, many simultaneous projections.
 *
 * This is the IDENTITY and PROJECTION atoms, burned before anything draws.
 * The rule the whole file exists to hold:
 *
 *     DESKTOP != canonical
 *     TABLET  != canonical
 *     PHONE   != canonical
 *     CLOUD   != canonical
 *     HOME / project identity = canonical
 *
 * A device is a LEG of one environment. It is not a copy of it, it is not a
 * smaller version of another leg, and it is never the place the truth lives —
 * which is why a phone that loses the wire keeps working against HOME rather
 * than becoming the owner of a private, diverging state.
 *
 * The three device names are NOT re-declared here. They are read from
 * chatSnap.mjs, because a second declaration of "what the three devices are
 * called" is exactly the drift this file is supposed to make impossible.
 */
import { DEVICE } from './chatSnap.mjs';

export { DEVICE };

export const PROJECTION_SCHEMA = 'xiio.projection/v1';

/* ── THE SIX AXES ────────────────────────────────────────────────────────────
 *
 * Declared, not implied. Every question the paired app asks lands on exactly one
 * of these, and naming them is what stops a layout problem being answered with a
 * sync change and a sync problem being answered with CSS.
 */
export const AXIS = Object.freeze({
  IDENTITY: 'IDENTITY',     // user / HOME / project / conversation / resource
  STATE: 'STATE',           // canonical state, server-side and local-first
  CAPABILITY: 'CAPABILITY', // what this user, project and device may do
  PROJECTION: 'PROJECTION', // desktop / tablet / phone / web / print
  PRESENCE: 'PRESENCE',     // which projections are currently connected
  SYNC: 'SYNC',             // generation / diff / conflict / receipt / return
});

export const AXIS_MEANING = Object.freeze({
  IDENTITY: 'who and what this is — the only axis that is canonical',
  STATE: 'the canonical state itself, held once and read by every projection',
  CAPABILITY: 'what this user, project and device are permitted to do',
  PROJECTION: 'which window onto the environment this is',
  PRESENCE: 'which projections are connected right now',
  SYNC: 'how a change crosses between projections and is proven to have arrived',
});

/* The canonical coordinate. There is exactly one, and it is not a device. */
export const CANONICAL = 'HOME';

/* ── THE THREE ROLES ─────────────────────────────────────────────────────────
 *
 * Not sizes. A role is what the projection is FOR, and it is answered here once
 * so a desktop and a phone cannot disagree about what the same environment is
 * for. "Smaller" is not a role, which is why the phone is not described as a
 * narrow desktop anywhere below.
 */
export const ROLE = Object.freeze({
  POWER_WORKBENCH: 'POWER_WORKBENCH',
  PRIMARY_WORKSPACE: 'PRIMARY_WORKSPACE',
  COMPANION_CONTROL: 'COMPANION_CONTROL',
});

const ROLE_OF_DEVICE = Object.freeze({
  [DEVICE.DESKTOP]: ROLE.POWER_WORKBENCH,
  [DEVICE.TABLET]: ROLE.PRIMARY_WORKSPACE,
  [DEVICE.MOBILE]: ROLE.COMPANION_CONTROL,
});

const CARRIES_OF_DEVICE = Object.freeze({
  [DEVICE.DESKTOP]: [
    'golden window',
    'file explorer',
    'conversation and work',
    'dynamic tool dock and settings',
    'multiple attached chats',
    'vectorforge canvas',
    'cli and hex',
    'production surfaces',
  ],
  [DEVICE.TABLET]: [
    'the same project',
    'canvas through split or toggle',
    'conversation through split or toggle',
    'tools through split or toggle',
    'touch as the primary instrument',
  ],
  [DEVICE.MOBILE]: [
    'chats',
    'approvals',
    'notifications',
    'tasks',
    'evidence capture',
    'quick edits',
    'status',
    'media',
    'remote control',
  ],
});

/* What this projection is for. An unnamed device is REFUSED rather than guessed:
   a surface that passed 'phone' would be handed a desktop's shape and would look
   correct in every screenshot taken of it. */
export function projectionRole(device) {
  if (!Object.values(DEVICE).includes(device)) {
    return { ok: false, first_red: 'DEVICE_REQUIRED' };
  }
  return {
    ok: true,
    schema: PROJECTION_SCHEMA,
    device,
    role: ROLE_OF_DEVICE[device],
    carries: CARRIES_OF_DEVICE[device],
    /* Every projection answers this the same way, and the answer is the point of
       the file: this device is a window onto HOME, not the place HOME lives. */
    canonical: false,
    canonical_coordinate: CANONICAL,
  };
}

/* The invariant, as a function, so it can be asserted rather than believed.
   A device that claimed canonical would be a device whose local state silently
   outranked the user's own environment. */
export function isCanonical(subject) {
  return subject === CANONICAL || subject === 'PROJECT';
}

/* ── THE ADDRESS ─────────────────────────────────────────────────────────────
 *
 * Borrowed deliberately from WindowRow, which already solved this shape: durable
 * identity is held separately from the occurrence that observed it, the carrier
 * legs are held separately from the coordinates, and a missing coordinate is
 * REPORTED rather than filled with a plausible default.
 *
 * The load-bearing line is that DEVICE IS NOT A COORDINATE. It sits in `carrier`
 * beside COM, because a phone and a desktop looking at one project are one
 * address observed twice — not two addresses. Put the device in the identity and
 * every projection becomes its own project, which is precisely the failure this
 * whole architecture exists to prevent.
 */
const COORDINATES = ['HOME', 'PROJECT', 'CONVERSATION', 'RESOURCE'];

export function projectionAddress({
  home,
  project_ref,
  conversation_ref,
  resource_ref,
  device,
  com,
} = {}) {
  const parts = {
    HOME: home ?? null,
    PROJECT: project_ref ?? null,
    CONVERSATION: conversation_ref ?? null,
    RESOURCE: resource_ref ?? null,
  };
  const missing = COORDINATES.filter((k) => !parts[k]);
  const carrier = { DEVICE: device ?? null, COM: com ?? null };

  return {
    ok: missing.length === 0,
    schema: PROJECTION_SCHEMA,
    parts,
    carrier,
    missing,
    addressable: missing.length === 0,
    ref: missing.length ? null : COORDINATES.map((k) => parts[k]).join('/'),
    /* An address is never given a device-shaped identity, whatever the caller
       passes. Declared as its own field so a reader can check it. */
    device_in_identity: false,
  };
}

/* ── TWO OBSERVATIONS OF ONE ENVIRONMENT ─────────────────────────────────────
 *
 * HOME_SPLIT is the multi-user leak and is named before any other verdict,
 * because contamination between two users is not a drift and must never be
 * reported as one.
 */
export function classifyProjection(a, b) {
  if (!a || !b) return 'UNOBSERVED';
  if (a.home !== b.home) return 'HOME_SPLIT';
  if (a.project_ref !== b.project_ref) return 'PROJECT_SPLIT';
  if (a.effect_ceiling && a.effect_ceiling !== b.effect_ceiling) return 'AUTHORITY_VIOLATION';

  const setOf = (x) => [...(x.conversation_refs ?? [])].sort().join('|');
  if (setOf(a) !== setOf(b)) return 'DRIFT';

  const toolsOf = (x) => [...(x.tool_refs ?? [])].sort().join('|');
  if (toolsOf(a) !== toolsOf(b)) return 'DRIFT';

  const settingsOf = (x) => JSON.stringify(x.settings ?? {});
  if (settingsOf(a) !== settingsOf(b)) return 'DRIFT';

  /* Same content, different generation: one projection is behind. That is a
     WAIT for the stale leg, never a corruption and never a pass. */
  if ((a.generation ?? 0) !== (b.generation ?? 0)) return 'STALE';
  return 'CONSERVED';
}

/* ── THE TWENTY LEGS ─────────────────────────────────────────────────────────
 *
 * Declared once, here, so the hostile that runs them and the reading that
 * reports them cannot describe two different tests. One test, twenty legs.
 */
export const PAIRED_LEGS = Object.freeze([
  { n: 1, says: 'open project on desktop', axis: AXIS.PROJECTION, expect: 'BOUND' },
  { n: 2, says: 'attach chat A', axis: AXIS.STATE, expect: 'ATTACHED' },
  { n: 3, says: "tool dock gains A's tools", axis: AXIS.CAPABILITY, expect: 'TOOLS_PRESENT' },
  { n: 4, says: 'open SAME project on phone', axis: AXIS.PRESENCE, expect: 'SAME_BINDING' },
  { n: 5, says: 'phone sees chat A + applicable phone tools', axis: AXIS.PROJECTION, expect: 'VISIBLE_AS_COMPANION' },
  { n: 6, says: 'change project setting on phone', axis: AXIS.STATE, expect: 'SET' },
  { n: 7, says: 'server receives exact project/user setting', axis: AXIS.STATE, expect: 'EXACT' },
  { n: 8, says: 'desktop independently reads the change', axis: AXIS.SYNC, expect: 'READ_BACK' },
  { n: 9, says: 'attach chat B on tablet', axis: AXIS.STATE, expect: 'ATTACHED' },
  { n: 10, says: 'desktop and phone receive B', axis: AXIS.SYNC, expect: 'BOTH_READ' },
  { n: 11, says: 'detach A on desktop', axis: AXIS.STATE, expect: 'DETACHED' },
  { n: 12, says: 'A disappears from active tools everywhere', axis: AXIS.SYNC, expect: 'GONE_EVERYWHERE' },
  { n: 13, says: 'search history on phone', axis: AXIS.IDENTITY, expect: 'FOUND' },
  { n: 14, says: 'find A by project/tag', axis: AXIS.IDENTITY, expect: 'FOUND_BY_TAG' },
  { n: 15, says: 'reattach A', axis: AXIS.STATE, expect: 'REATTACHED' },
  { n: 16, says: 'correct tools return', axis: AXIS.CAPABILITY, expect: 'TOOLS_RESTORED' },
  { n: 17, says: 'kill cloud connectivity', axis: AXIS.SYNC, expect: 'OFFLINE' },
  { n: 18, says: 'local desktop continues against HOME', axis: AXIS.STATE, expect: 'LOCAL_CONTINUES' },
  { n: 19, says: 'restore network', axis: AXIS.SYNC, expect: 'PUSHED' },
  { n: 20, says: 'reconcile without duplicate project/chat/file identities', axis: AXIS.SYNC, expect: 'NO_DUPLICATES' },
]);

export const METAPHOR = Object.freeze({
  law: 'ONE_SOVEREIGN_ENVIRONMENT_MANY_SIMULTANEOUS_PROJECTIONS_AND_NO_DEVICE_IS_CANONICAL',
});