import { freeChat, snapChat as bindProtocol, unsnapChat } from '@/lib/chatSnap.mjs';
export function transitionChat(state, action) {
  if (action.type === 'SNAP') {
    const target = action.target;
    if (!target?.id || !target?.workRef) throw new Error('TARGET_ADDRESS_REQUIRED');
    const generation = state.generation + 1;
    const protocol = bindProtocol(state.protocol || freeChat({ conversation_ref: state.conversationRef }), {
      target_ref: target.id, work_ref: target.workRef, projection_ref: `${state.conversationRef}:shadow:${generation}`, generation,
    });
    if (!protocol.ok) throw new Error(protocol.first_red);
    const { element, ...binding } = target;
    return { ...state, binding, protocol, generation };
  }
  if (action.type === 'DETACH') return { ...state, binding: null, protocol: unsnapChat(state.protocol), generation: state.generation + 1 };
  return state;
}
export function pairedProjection(t, source) {
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error('UNIT_INTERVAL_REQUIRED');
  if (!source.forward || !source.counter || source.forward === source.counter) throw new Error('DISTINCT_CARRIERS_REQUIRED');
  return { forward: { ref: source.forward, position: 2 * t - 1 }, counter: { ref: source.counter, position: 1 - 2 * t }, seam: t === .5 };
}