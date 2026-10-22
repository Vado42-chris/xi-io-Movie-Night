import { Search, Database, Boxes, Wand2, ScrollText, Network } from 'lucide-react';

/* ── WHAT A PINNED PRODUCT BRINGS TO THE DRAWER ──────────────────────────────
 *
 * The drawer already showed tools for an attached PAGE — it reads them from the
 * page's own declaration in the registry. A pinned PRODUCT had none, because it
 * is not a page: it is an application, opened inside its own window, and the
 * registry keys tools by route. So a chat snapped to a product got a drawer
 * with the product's name on it and nothing behind the name.
 *
 * These are the Studio's own workbench tools, and each one is a real surface
 * that renders and reads on its own. They are grouped by what the application
 * is FOR, and an application that genuinely brings nothing declares nothing —
 * an empty list is a real answer and is never padded to make the drawer look
 * full.
 *
 * ── WHY THIS IS A `.mjs` ────────────────────────────────────────────────────
 *
 * `attachedTools.js` is runtime-neutral and a node-side script drives it. It
 * reached these tools through `components/studio/appTools.js` — which imported
 * six React components — so the chain was:
 *
 *     attachedTools.js → appTools.js → SearchForge.jsx → ERR_UNKNOWN_FILE_EXTENSION
 *
 * The same leak the tool catalogue had, one file over. The identity of a
 * workbench tool is data and lives here; what draws it is registered by name in
 * `src/lib/toolBindings.jsx`. `appTools.js` still exists for the browser and is
 * now a re-export of this module with the renderer merged on — so every
 * existing caller keeps working and the neutral path never touches a `.jsx`.
 */
const WORKBENCH = {
  search: { id: 'search_forge', label: 'Search Forge', icon: Search, body: 'SearchForge', category: 'analysis' },
  canonical: { id: 'canonical_search', label: 'Canonical', icon: Database, body: 'CanonicalSearch', category: 'analysis' },
  records: { id: 'data_forge', label: 'Records', icon: Boxes, body: 'DataForgeRecords', category: 'data' },
  cherry: { id: 'cherry_tools', label: 'Cherry Tools', icon: Wand2, body: 'CherryTools', category: 'engineering' },
  publication: { id: 'publication', label: 'Publication', icon: ScrollText, body: 'PublicationReadback', category: 'authoring' },
  antchain: { id: 'ant_chain', label: 'Ant Chain', icon: Network, body: 'AntChainLadder', category: 'operations' },
};

const APP_WORKBENCH = {
  web: ['search', 'cherry', 'publication'],
  mobile: ['search', 'cherry', 'publication'],
  architect: ['search', 'cherry', 'canonical', 'publication'],
  document: ['search', 'cherry', 'publication'],
  sheet: ['records', 'cherry', 'publication'],
  office: ['records', 'canonical', 'search', 'cherry', 'publication'],
  Office: ['records', 'canonical', 'search', 'cherry', 'publication'],
  layout: ['cherry', 'publication'],
  blog: ['search', 'cherry', 'publication'],
  sound: ['cherry', 'publication'],
  cinema: ['cherry', 'publication'],
  '3d': ['cherry', 'publication'],
  cad: ['cherry', 'publication'],
  vector: ['cherry', 'publication'],
  store: ['records', 'cherry', 'publication'],
  mail: ['cherry', 'publication'],
  database: ['records', 'canonical', 'cherry'],
  browser: ['search', 'canonical', 'antchain'],
};

/* A pinned application addresses itself by its app id, and by the pin it was
   opened in — so two windows on one application are two windows, and the app
   is still readable off the reference alone after a reload. */
export const APP_TARGET_PREFIX = 'app:';

export const appTargetRef = (appId, pinId) => `${APP_TARGET_PREFIX}${appId}#${pinId}`;

export const appOfTarget = (ref) =>
  typeof ref === 'string' && ref.startsWith(APP_TARGET_PREFIX)
    ? ref.slice(APP_TARGET_PREFIX.length).split('#')[0]
    : null;

export const WORKBENCH_TOOLS = WORKBENCH;

export const declaredToolsForApp = (appId) =>
  (APP_WORKBENCH[appId] || []).map((key) => WORKBENCH[key]).filter(Boolean);