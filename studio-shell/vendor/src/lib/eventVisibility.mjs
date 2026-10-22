import { resolveRootContext, VISIBILITY } from './rootContext.mjs';

export const EVENT_VISIBILITY = Object.freeze({
  PUBLIC: VISIBILITY.PUBLIC,
  PRIVATE: VISIBILITY.PRIVATE,
  WORK: VISIBILITY.WORK,
  UNKNOWN: 'UNKNOWN',
});

export function normalizeEventVisibility(value) {
  const v = String(value || '').trim().toUpperCase();
  return Object.values(EVENT_VISIBILITY).includes(v) ? v : EVENT_VISIBILITY.UNKNOWN;
}

export function visibilityForPrivacyMode(privacyMode) {
  const root = resolveRootContext({ privacyMode });
  return root.ok ? root.visibility_mode : null;
}

export function eventVisibleInMode(event, privacyMode) {
  const current = visibilityForPrivacyMode(privacyMode);
  const eventMode = normalizeEventVisibility(event?.visibility_mode);
  return Boolean(current && eventMode !== EVENT_VISIBILITY.UNKNOWN && eventMode === current);
}

export function partitionEventsByVisibility(events = [], privacyMode) {
  const current = visibilityForPrivacyMode(privacyMode);
  const visible = [];
  const withheld = [];
  for (const event of Array.isArray(events) ? events : []) {
    const mode = normalizeEventVisibility(event?.visibility_mode);
    if (current && mode === current) visible.push(event);
    else withheld.push({ event, visibility_mode: mode });
  }
  return { current, visible, withheld };
}