// The app declaration supplies all values and rules. This module interprets
// the bounded schema subset; it neither owns preferences nor grants permission.
const META = 'x-xiio';
const KEYWORDS = new Set(['$schema','$id','title','description','type','additionalProperties','required','properties','enum','minimum','maximum','minLength','maxLength','pattern','default',META]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameKeys = (a, b) => a.length === b.length && a.every(key => b.includes(key));
export function accepts(node, value) {
  if (node.type === 'object') return object(value) && sameKeys(Object.keys(value), Object.keys(node.properties)) && Object.entries(node.properties).every(([key, rule]) => accepts(rule, value[key]));
  if (node.type === 'boolean') { if (typeof value !== 'boolean') return false; }
  else if (node.type === 'integer') { if (!Number.isInteger(value) || value < (node.minimum ?? -Infinity) || value > (node.maximum ?? Infinity)) return false; }
  else if (node.type === 'string') {
    if (typeof value !== 'string' || Array.from(value).length < (node.minLength ?? 0) || Array.from(value).length > (node.maxLength ?? Infinity)) return false;
    if (node.pattern && !new RegExp(node.pattern).test(value)) return false;
  } else return false;
  return !node.enum || node.enum.some(allowed => allowed === value);
}
export function defaults(node) {
  return node.type === 'object' ? Object.fromEntries(Object.entries(node.properties).map(([key, rule]) => [key, defaults(rule)])) : structuredClone(node.default);
}
export function qualify(declaration) {
  const meta = declaration?.[META];
  const required = ['declaration_version','owner','record_schema','maximum_revision','scope','binding_registry','read','write','reset','import','export','section_order'];
  if (!object(meta) || !required.every(key => Boolean(meta[key]))) throw new Error('Settings declaration metadata incomplete');
  if (!object(declaration.properties) || !Array.isArray(meta.section_order) || !sameKeys(meta.section_order, Object.keys(declaration.properties)) || new Set(meta.section_order).size !== meta.section_order.length) throw new Error('Settings section conflict');
  function walk(node, pointer = '') {
    if (!object(node) || Object.keys(node).some(key => !KEYWORDS.has(key))) throw new Error('Unsupported declaration keyword');
    if (node.type === 'object') {
      if (!object(node.properties) || !Object.keys(node.properties).length || node.additionalProperties !== false || !Array.isArray(node.required) || !sameKeys(node.required, Object.keys(node.properties)) || new Set(node.required).size !== node.required.length) throw new Error('Incomplete object declaration');
      for (const [key, child] of Object.entries(node.properties)) {
        if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error('Invalid setting key');
        walk(child, `${pointer}/${key}`);
      }
      return;
    }
    const m = node[META] || {};
    if (!['boolean','integer','string'].includes(node.type) || !Object.hasOwn(node, 'default') || !accepts(node, node.default)) throw new Error('Invalid declared default');
    if (m.owner !== meta.owner || m.scope !== meta.scope || m.pointer !== pointer || m.read_binding !== meta.read || m.write_binding !== meta.write) throw new Error('Settings owner, scope or binding conflict');
    if (!object(m.permissions) || !sameKeys(Object.keys(m.permissions), ['read','write']) || !Object.values(m.permissions).every(Boolean)) throw new Error('Setting permissions missing');
    if (!object(m.operations) || !sameKeys(Object.keys(m.operations), ['import','export','reset']) || !Object.values(m.operations).every(v => typeof v === 'boolean')) throw new Error('Setting operation policy missing');
    if (!['toggle','range','select','select-number','model'].includes(m.control?.type)) throw new Error('Setting control metadata missing');
    if (node.enum && (!Array.isArray(node.enum) || !node.enum.length || new Set(node.enum.map(JSON.stringify)).size !== node.enum.length || !sameKeys(Object.keys(m.control.option_labels || {}), node.enum.map(String)))) throw new Error('Option label mismatch');
    if (!m.effect?.consumer_ref || !m.effect?.apply_when) throw new Error('Setting effect consumer missing');
  }
  walk(declaration);
  return declaration;
}
export function fields(declaration) {
  return declaration[META].section_order.flatMap(section => Object.entries(declaration.properties[section].properties).map(([key, rule]) => {
    const control = rule[META].control;
    return { section, key, label: rule.title, hint: rule.description, ...control,
      min: rule.minimum, max: rule.maximum,
      options: rule.enum?.map(value => [value, control.option_labels[String(value)]]) };
  }));
}
export function document(declaration, value) {
  if (!object(value) || !sameKeys(Object.keys(value), ['revision','settings']) || !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > declaration[META].maximum_revision || !accepts(declaration, value.settings)) throw new Error('The settings response does not match its declaration. Reload your preferences.');
  return value;
}
// Import and export are independent declared permissions, not UI assumptions.
export function supportsTransfer(declaration, operation) {
  if (!['import', 'export'].includes(operation) || !object(declaration?.properties)) return false;
  const sections = Object.values(declaration.properties);
  if (!sections.length || sections.some(section => !object(section?.properties))) return false;
  const rules = sections.flatMap(section => Object.values(section.properties));
  return rules.length > 0 && rules.every(rule => rule?.[META]?.operations?.[operation] === true);
}
function requireTransfer(declaration, operation) {
  if (!supportsTransfer(declaration, operation)) throw new Error(`This declaration does not support a complete ${operation}. Nothing was changed.`);
}
function encodeTransfer(declaration, settings) {
  if (!accepts(declaration, settings)) throw new Error('Invalid settings transfer');
  return {schema:'movie-night.settings-export/v1', declaration:declaration.$id, version:declaration[META].declaration_version, settings:structuredClone(settings)};
}
function decodeTransfer(declaration, value) {
  if (!object(value) || !sameKeys(Object.keys(value), ['schema','declaration','version','settings']) || value.schema !== 'movie-night.settings-export/v1' || value.declaration !== declaration.$id || value.version !== declaration[META].declaration_version || !accepts(declaration, value.settings)) throw new Error('This file does not match the Movie Night settings declaration. Nothing was changed.');
  return structuredClone(value.settings);
}
export function exportDocument(declaration, settings) { requireTransfer(declaration, 'export'); return encodeTransfer(declaration, settings); }
export function readExportDocument(declaration, value) { requireTransfer(declaration, 'export'); return decodeTransfer(declaration, value); }
export function importDocument(declaration, value) { requireTransfer(declaration, 'import'); return decodeTransfer(declaration, value); }
export function importRequest(declaration, settings, revision) {
  requireTransfer(declaration, 'import'); document(declaration, {revision, settings});
  if (revision >= declaration[META].maximum_revision) throw new Error('The settings revision cannot be advanced. Nothing was changed.');
  return {revision, document:encodeTransfer(declaration, settings)};
}
