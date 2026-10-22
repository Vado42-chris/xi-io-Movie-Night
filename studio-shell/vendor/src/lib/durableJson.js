/* ── WHAT MAY BE WRITTEN TO STORAGE ──────────────────────────────────────────
 *
 * The desk saves windows, pins and widgets as JSON, and those records carry
 * things JSON cannot hold: an icon is a React component, and a pin may be handed
 * a live element. JSON.stringify turns a component object into `{}` and throws
 * outright on an element (it points back into React's own fibre tree).
 *
 * `{}` is the dangerous one. It is TRUTHY, so a window read back with
 * `icon: {}` is drawn as `<{} />` — "Element type is invalid" — and the desk
 * falls over on the very first render of the reload that was meant to bring the
 * window back. A throw is worse still: the whole write is lost, and because the
 * caller swallowed it, nothing says so.
 *
 * So the value that cannot survive is LEFT OUT, not mangled. A missing icon is
 * an absence a reader can fill from the registry; an empty object is a lie
 * that looks like an icon.
 */
export function durableStringify(value) {
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'function') return undefined;
    if (val && typeof val === 'object' && val.$$typeof) return undefined;
    return val;
  });
}