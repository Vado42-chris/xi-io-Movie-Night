/* ── THE ROOT CONTEXT · THE FIRST PROJECTION DECISION ─────────────────────────
 *
 * Privacy is not a downstream setting attached to a project after it exists. It
 * is the FIRST decision every Studio object inherits, before SDK, Articles,
 * Publisher, tools, agents, services or egress get to do anything:
 *
 *     STUDIO ROOT
 *        ↓
 *     VISIBILITY / CONTEXT MODE
 *        ├── PUBLIC
 *        ├── PRIVATE
 *        └── WORK MODE
 *             ↓
 *     TRINITY GATES
 *     SDK ↔ ARTICLES ↔ PUBLISHER
 *
 * ── WHAT WAS WRONG BEFORE THIS FILE ─────────────────────────────────────────
 *
 * The selector already existed (`PrivacyModeDropdown`, the shell's own
 * `privacyMode`) and it was already a policy surface — the defect was underneath
 * it. Nothing turned that selection into an ENVELOPE, so each tier was free to
 * decide for itself what "private" meant, and the estate's actual sequence was
 * the one this contract refuses:
 *
 *     build artifact → attach tools → connect services → later ask if it
 *     should have been private
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────────
 *
 *     ROOT PRIVACY MODE MUST BE RESOLVED BEFORE CAPABILITY RESOLUTION
 *
 * A primitive, tool, agent, service, export, marketplace item or microsite with
 * no resolved root context is REFUSED — not defaulted. `resolveRootContext`
 * therefore fails CLOSED: an unrecognised visibility setting yields no envelope
 * and no permission at all, because a missing root is the one input whose
 * absence must never be read as "the permissive one".
 *
 * ── THE THREE MODES ARE POLICIES, NOT THEMES ────────────────────────────────
 *
 *   PUBLIC   projection-oriented. Shareable views, routed microsites and
 *            outward Publisher actions are permitted, subject to the artifact's
 *            own permissions. Private evidence is NOT admitted here.
 *   PRIVATE  fail-closed local/personal custody. Publisher egress, public
 *            routes, external agents/services and marketplace actions default
 *            to unavailable unless explicitly promoted through a gate.
 *   WORK     professional/organizational. Neither public nor purely personal:
 *            team seats, organization policy, client context, governed services
 *            and business-safe egress, with audit/receipt required.
 *
 * These are read from HERE and nowhere else. A tier that restated its own idea
 * of what private means would be a second declaration of one policy, and the
 * drift between two such declarations is the bug this file exists to prevent.
 */
export const ROOT_CONTEXT_SCHEMA = 'xiio.root-context/v1';
export const ROOT_CONTEXT_HOSTILE = 'SCR-ROOT-CONTEXT-001';

/* ── THE VISIBILITY MODES ────────────────────────────────────────────────────
 *
 * The shell's own three settings, spelled once. `VISIBILITY_FOR_PRIVACY` is the
 * ONE translation from the selector's vocabulary into the envelope's, so the
 * string 'private' is understood in exactly one place. */
export const VISIBILITY = Object.freeze({
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  WORK: 'WORK',
});

export const VISIBILITY_FOR_PRIVACY = Object.freeze({
  public: VISIBILITY.PUBLIC,
  private: VISIBILITY.PRIVATE,
  work: VISIBILITY.WORK,
});

/* ── CUSTODY ─────────────────────────────────────────────────────────────────
 *
 * Who holds the material this context admits. SHAREABLE material may be
 * projected; LOCAL_ONLY material never leaves its own runtime; ORGANIZATION
 * material stays inside the workspace it belongs to. */
export const CUSTODY_POLICY = Object.freeze({
  SHAREABLE: 'SHAREABLE',
  LOCAL_ONLY: 'LOCAL_ONLY',
  ORGANIZATION: 'ORGANIZATION',
});

/* ── WHAT MAY BE REACHED ─────────────────────────────────────────────────────
 *
 * `allowed_services` and `allowed_agents` are the same three rungs for both:
 * PUBLIC_ONLY / LOCAL_ONLY / GOVERNED. Declared as one vocabulary so a service
 * and an agent cannot be judged by two different scales. */
export const REACH = Object.freeze({
  PUBLIC: 'PUBLIC_ONLY',
  LOCAL: 'LOCAL_ONLY',
  GOVERNED: 'GOVERNED',
});

/* ── THE THREE POLICIES, IN FULL ─────────────────────────────────────────────
 *
 * Every field the envelope carries is declared per mode rather than computed
 * from the mode's name — a policy derived from a string is a policy nobody can
 * read, and this is the surface a person is meant to be able to check.
 *
 * `effect_mode` is the ONE field the Z2 resolver consumes directly: it is the
 * ceiling on effect that this visibility setting implies (see
 * src/lib/contextResolver.mjs). PUBLIC resolves to WORK because projection and
 * egress ARE permitted there — the restriction public carries is on CUSTODY,
 * not on reach, and expressing it as a low ceiling would refuse the very
 * publishing the mode exists to enable. */
const POLICY = Object.freeze({
  [VISIBILITY.PUBLIC]: Object.freeze({
    audience: 'SHAREABLE',
    custody_policy: CUSTODY_POLICY.SHAREABLE,
    allowed_services: REACH.PUBLIC,
    allowed_agents: REACH.PUBLIC,
    allowed_egress: true,
    allowed_marketplace: true,
    allowed_projection: true,
    admits_private_custody: false,
    requires_receipt: false,
    effect_mode: 'work',
    says: 'Projection-oriented. Shareable views, routed microsites and outward Publisher actions are permitted; private evidence is not admitted here.',
  }),
  [VISIBILITY.PRIVATE]: Object.freeze({
    audience: 'SELF',
    custody_policy: CUSTODY_POLICY.LOCAL_ONLY,
    allowed_services: REACH.LOCAL,
    allowed_agents: REACH.LOCAL,
    allowed_egress: false,
    allowed_marketplace: false,
    allowed_projection: false,
    admits_private_custody: true,
    requires_receipt: false,
    effect_mode: 'private',
    says: 'Fail-closed local custody. Egress, public routes, external agents/services and marketplace actions are unavailable unless explicitly promoted through a gate.',
  }),
  [VISIBILITY.WORK]: Object.freeze({
    audience: 'ORGANIZATION',
    custody_policy: CUSTODY_POLICY.ORGANIZATION,
    allowed_services: REACH.GOVERNED,
    allowed_agents: REACH.GOVERNED,
    allowed_egress: true,
    allowed_marketplace: false,
    allowed_projection: true,
    admits_private_custody: false,
    requires_receipt: true,
    effect_mode: 'work',
    says: 'Professional/organizational context. Governed services and business-safe egress are permitted; marketplace actions and personal custody are not.',
  }),
});

/* ── THE RESOLUTION ──────────────────────────────────────────────────────────
 *
 * The one call every tier must make before it does anything. It returns an
 * ENVELOPE on success and a REFUSAL on failure, and the two are distinguishable
 * by `ok` — never by the absence of a field.
 *
 * `owner` and `workspace` are carried, not checked: this file knows the mode's
 * policy and does not know who is asking. What it does with them is hand them
 * to the gates, so a tier can rule on them where it has the facts. */
export function resolveRootContext({ privacyMode, owner = null, workspace = null, declared_by = null, at = null } = {}) {
  const visibility_mode = VISIBILITY_FOR_PRIVACY[privacyMode];

  /* ── FAIL CLOSED ─────────────────────────────────────────────────────────
   * An unrecognised setting is not rounded to the resting one. A selector that
   * has not answered, or answered in a word this contract does not carry, has
   * not earned any permission at all — and the refusal is named so the surface
   * can say WHY rather than simply showing nothing. */
  if (!visibility_mode) {
    return {
      schema: ROOT_CONTEXT_SCHEMA,
      ok: false,
      visibility_mode: null,
      first_red: 'ROOT_VISIBILITY_UNRESOLVED',
      says: privacyMode
        ? `visibility "${privacyMode}" is not a mode this contract carries, so nothing is admitted.`
        : 'no visibility mode was supplied, so nothing is admitted.',
    };
  }

  const policy = POLICY[visibility_mode];

  return {
    schema: ROOT_CONTEXT_SCHEMA,
    ok: true,
    hostile: ROOT_CONTEXT_HOSTILE,
    visibility_mode,
    owner,
    workspace,
    declared_by,
    at,
    ...policy,
  };
}

/* ── THE EFFECT MODE ─────────────────────────────────────────────────────────
 *
 * What the Z2 resolver consumes. Exported on its own because it is the one
 * field that crosses into a second vocabulary, and a crossing that is not
 * named is a crossing nobody can audit.
 *
 * An unresolved root returns null — which is NOT the resolver's permissive
 * fallback by accident. The resolver treats a null mode as "nobody supplied
 * this" and records it as an owed input, so an unresolved root is VISIBLE at
 * the drawer rather than silently disarming it. */
export function effectModeFromPrivacy(privacyMode) {
  const root = resolveRootContext({ privacyMode });
  return root.ok ? root.effect_mode : null;
}

/* ── THE READING ─────────────────────────────────────────────────────────────
 *
 * What this contract is, for a surface that has to explain itself. */
export function readRootContextContract() {
  return {
    schema: ROOT_CONTEXT_SCHEMA,
    hostile: ROOT_CONTEXT_HOSTILE,
    visibility_modes: Object.values(VISIBILITY),
    custody_policies: Object.values(CUSTODY_POLICY),
    reach: Object.values(REACH),
    policies: Object.fromEntries(
      Object.entries(POLICY).map(([mode, p]) => [mode, { ...p }]),
    ),
    order: ['ROOT_CONTEXT', 'SDK', 'ARTICLES', 'PUBLISHER'],
    hard: [
      'ROOT_PRIVACY_MODE_MUST_BE_RESOLVED_BEFORE_CAPABILITY_RESOLUTION',
      'NO_PRIMITIVE_WITHOUT_ROOT_CONTEXT',
      'NO_TOOL_WITHOUT_ROOT_CONTEXT',
      'NO_AGENT_WITHOUT_ROOT_CONTEXT',
      'NO_SERVICE_WITHOUT_ROOT_CONTEXT',
      'NO_EXPORT_WITHOUT_ROOT_CONTEXT',
      'NO_MARKETPLACE_WITHOUT_ROOT_CONTEXT',
      'NO_MICROSITE_WITHOUT_ROOT_CONTEXT',
      'AN_UNRESOLVED_ROOT_IS_NOT_THE_PERMISSIVE_ONE',
      'A_DOWNSTREAM_TIER_MAY_ONLY_NARROW',
    ],
  };
}