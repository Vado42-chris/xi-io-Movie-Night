import { compileEnvelope, acceptFreshWorker } from '@/lib/step5.mjs';
import { OPERATOR_RUNGS, LOOP_RING } from '@/lib/pneumaContract.mjs';
import { projectShadow, shadowOf, resetOf } from '@/lib/shadowProjection.mjs';
export const CHAT_AXES = Object.freeze(['VALUE', 'AXIS', 'SCALE', 'PLANE', 'DIRECTION', 'ORIENTATION', 'PROJECTION']);
export const CHAT_LEXICON = Object.freeze({ foreground: 'Daylight', shadow: 'Engine room', seam: 'Waterline', note: 'One conversation above and below the waterline; two views, not two agents.' });
export function newChatAddress(uuid = () => crypto.randomUUID()) {
  return { ref: `chat:${uuid()}`, uuids: Object.fromEntries(CHAT_AXES.map(axis => [axis, uuid()])) };
}
export function workEnvelope(state) {
  const b = state.binding;
  return compileEnvelope({ coordinate: b?.coordinate, subject: state.conversationRef, state: {
    root: b?.root, base: b?.base, home: b?.home, floor: b?.floor, ceiling: b?.ceiling, compass: b?.compass,
    payload: b?.workRef, time: b?.observedAt, billing: b?.billing, delivered: b?.delivered,
    return_to: state.conversationRef, resume: b?.workRef,
  } });
}
export function readChatWork(state) {
  const envelope = workEnvelope(state);
  return { envelope, acceptance: acceptFreshWorker(envelope), operator: OPERATOR_RUNGS,
    shadow: projectShadow(), ring: LOOP_RING, pivot: shadowOf(5), reset: resetOf(LOOP_RING) };
}
// Right-angle rotation is bijective. Extrusion retains XY; flattening retains
// provenance, so +Z and -Z share a footprint but NEVER an addressed identity.
export function rotateCell({ x, y, z, address }, turns = 1) {
  let a = x, b = y;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [a, b] = [-b, a];
  return { x: a, y: b, z, address };
}
export const extrudeCell = (cell, z) => ({ ...cell, z });
export const flattenCell = cell => ({ x: cell.x, y: cell.y, provenance: { z: cell.z, address: cell.address } });
export const recoverCell = flat => ({ x: flat.x, y: flat.y, z: flat.provenance.z, address: flat.provenance.address });