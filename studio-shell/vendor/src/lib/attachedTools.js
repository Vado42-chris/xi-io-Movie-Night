/* ── RUNTIME-NEUTRAL, AND NOW ACTUALLY NEUTRAL ───────────────────────────────
 *
 * This module is imported by `chatAttachments.js`, which a node-side hostile
 * drives with no browser anywhere. It used to reach the tool catalogue through
 * `components/tools/ToolRegistry.jsx` — and the catalogue carried a React
 * component on every entry — so the attachment hostile died before execution:
 *
 *     attachedTools.js → ToolRegistry.jsx → ERR_UNKNOWN_FILE_EXTENSION ".jsx"
 *
 * A contract that names a thing by reaching for its renderer is the seam this
 * burn is about. The identity of a tool is data and lives in a `.mjs`; what
 * draws it lives in `toolBindings.jsx`. So this reads the identities, and the
 * drawing side resolves its own components — see toolComponent() in
 * src/lib/toolBindings.jsx. */
import { declaredToolsFor } from './toolCatalogue.mjs';
import { appOfTarget, declaredToolsForApp } from './appToolCatalogue.mjs';

/* ── WHICH WINDOW IS THIS, AND WHAT DOES IT BRING ────────────────────────────
 *
 * One declaration of the window address, shared by everything that has to
 * resolve a window to its surface — so a window's route is parsed in one place
 * and the drawer, the attach path and the canonical binding cannot disagree
 * about which surface a window is.
 *
 * `routeOfTarget` answers null for anything that is not a registry page — a
 * desktop window, an app panel — because "not a page" is a real answer and must
 * never be rounded to a plausible route.
 */
export const routeOfTarget = (target_ref) =>
  typeof target_ref === 'string' && target_ref.startsWith('page:/')
    ? target_ref.slice(6).split('?')[0]
    : null;

/* ── WHAT A WINDOW BRINGS TO THE DRAWER ──────────────────────────────────────
 *
 * Two populations, and a window is in exactly one of them:
 *
 *   a PAGE         tools declared against its route in the registry.
 *   an APPLICATION a pinned product, addressed by its app id — the drawer used
 *                  to answer "not a registry page" for these and stop, which
 *                  is how a chat snapped to a product got a drawer with the
 *                  product's name on it and nothing behind the name.
 *
 * A registry that cannot answer is reported as NONE rather than throwing — a
 * tool list is not worth losing an attachment over.
 */
export function toolsForTarget(target_ref) {
  const appId = appOfTarget(target_ref);
  if (appId) return declaredToolsForApp(appId);

  const route = routeOfTarget(target_ref);
  if (!route) return [];

  try {
    return declaredToolsFor(route);
  } catch {
    return [];
  }
}

/* The same answer, by registry id. This is what travels to the canonical
   binding, which is how a phone knows what a conversation it has never opened
   would offer it. */
export function declaredToolsForTarget(target_ref) {
  return toolsForTarget(target_ref).map((t) => t.id);
}