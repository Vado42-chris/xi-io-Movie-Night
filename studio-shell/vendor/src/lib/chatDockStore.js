import { useSyncExternalStore } from 'react';
import { transitionChat } from '@/lib/chatSnapContract.mjs';
import { freeChat, adoptChild as adoptChildProtocol, releaseChild as releaseChildProtocol } from '@/lib/chatSnap.mjs';
import { newChatAddress } from '@/lib/chatWorkProjection.mjs';
import { mayBindLane, edgeRef } from '@/lib/chatEdges.mjs';
import {
  getChatAttachments,
  recordAttach,
  recordDetach,
  recordDetachAll,
  hydrateAttachmentProjection,
  subscribeAttachments,
} from '@/lib/chatAttachments';
const address = newChatAddress();
/* `side` is which EDGE of the surface the conversation sits on once it is
 * snapped. The snap itself puts it on the right, and this is the choice the
 * owner makes afterwards — a conversation and the thing it is working on are
 * not always best read in one order, and the side is a fact about the
 * conversation rather than about the window it happens to be docked to. */
/* ── THE DOCK'S OWN FACTS OUTLIVE THE TAB ────────────────────────────────────
 *
 * `snapshot` was module memory and nothing else. `open`, `side`, `view` and the
 * environment address were gone the moment the tab reloaded — so a conversation
 * the operator had snapped to a window and set to the left edge came back
 * CLOSED, on the RIGHT, in the FOREGROUND. "The chat is not staying pinned" was
 * true of all four, and it was true every time.
 *
 * The attachments already survive (see chatAttachments): that is what remembers
 * WHICH conversation belongs to which window. What was missing is the dock's own
 * LAYOUT — the half a person actually arranged.
 *
 * Only the durable slice is written. `targets` are live DOM registrations, a
 * `protocol` is rebuilt from them, and a `binding` is restored from the
 * attachment memory; persisting any of those three would be storing a claim
 * about what is on screen, which a reload cannot honour. */
const DOCK_KEY = 'xiio.chat-dock/v1';

function readRememberedDock() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DOCK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const remembered = readRememberedDock();

let snapshot = {
  conversationRef: address.ref,
  address,
  protocol: freeChat({ conversation_ref: address.ref }),
  generation: 0,
  binding: null,
  environment: remembered?.environment || { root_ref: null, base_ref: null, home_ref: null, command_ref: 'COMDCCT' },
  targets: [],
  crew: [],
  view: remembered?.view === 'background' ? 'background' : 'foreground',
  side: remembered?.side === 'left' ? 'left' : 'right',
  open: Boolean(remembered?.open),
};
let projection = { source: 'UNOBSERVED', messages: [], status: 'UNOBSERVED', readback: null };
const listeners = new Set(), readers = new Set();

/* Written from `notify`, so every action that moves the dock is durable by
   construction. A writer that has to remember to persist is a writer that
   forgets — and one of these five already had no guard for exactly that
   reason, which is how the class of bug is known here rather than guessed. */
function persistDock() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DOCK_KEY, JSON.stringify({
      environment: snapshot.environment,
      view: snapshot.view,
      side: snapshot.side,
      open: snapshot.open,
    }));
  } catch {
    /* Private mode. The dock still works for this session, which is a real
       answer and is never rounded to "remembered". */
  }
}

const notify = () => { persistDock(); listeners.forEach(fn => fn()); };
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const getChatDock = () => snapshot;
export const useChatDock = () => useSyncExternalStore(subscribe, getChatDock, getChatDock);
/* ── THE PROJECTION IS SUBSCRIBED THROUGH NAMED FUNCTIONS ─────────────────────
 *
 * This was `useSyncExternalStore(fn => { readers.add(fn); ... }, () => projection,
 * () => projection)` — three NEW function identities on every render. React
 * compares the identity of `getSnapshot` to decide whether it has to re-check the
 * store in the COMMIT phase, so an inline arrow made `updateStoreInstance` run
 * after every commit of every reader. Pair that with a publisher that hands over a
 * freshly built object and you get a render that schedules a render that schedules
 * a render, until React aborts at fifty with "Maximum update depth exceeded" —
 * which is exactly the stack this produced.
 *
 * Named and hoisted, the identity is stable: the commit-phase re-check happens
 * only when something actually moved. The other five stores in the estate already
 * follow this rule; this one was the exception. */
const subscribeProjection = (fn) => { readers.add(fn); return () => readers.delete(fn); };
const getProjection = () => projection;
export const useChatProjection = () => useSyncExternalStore(subscribeProjection, getProjection, getProjection);

export function publishChatProjection(ref, value) {
  if (ref !== snapshot.conversationRef) return;
  /* ── A PUBLISH THAT SAYS NOTHING NEW IS NOT A CHANGE ──────────────────────
   *
   * Every publisher builds this record from state it already holds, so a caller
   * whose effect runs again hands over a NEW object carrying the SAME facts. A
   * new reference is a changed snapshot, which wakes every reader, which is a
   * render — and a publisher that runs per render then spins forever. Comparing
   * the fields the record is actually built from closes that: `messages` by
   * reference, because a rebuilt array with equal contents is the caller
   * re-rendering rather than the conversation moving. */
  if (projection.source === value.source
      && projection.status === value.status
      && projection.readback === value.readback
      && projection.messages === value.messages) return;
  projection = value; readers.forEach(fn => fn());
}
/* An attachment outlives the tab. The binding in this store is lost on reload,
 * but the attachment memory is not — so when a window opens that the memory says
 * is attached, it is bound again here, through the same snap and adopt the owner
 * would have used. Nothing is restored for a window that was un-attached:
 * un-attach clears the record, so a reload never re-attaches what was let go.
 *
 * Every condition below is one the protocol would refuse on, checked first, so a
 * restore never throws out of the effect that registered the window. */
function restoreAttachments() {
  const want = getChatAttachments().filter(r => r.attached);
  if (!want.length) return;
  const open = id => snapshot.targets.some(t => t.id === id);
  const lead = want.find(r => r.role === 'LEAD');
  if (!snapshot.binding && lead && open(lead.target_ref)) {
    // Restoring attachment is not a user request to reopen a dismissed chat.
    snapChat(lead.target_ref, { reveal: snapshot.open, view: snapshot.view });
  }
  if (!snapshot.binding) return;
  const crew = snapshot.protocol?.crew || [];
  want
    .filter(r => r.role === 'CHILD' && open(r.target_ref) && r.target_ref !== snapshot.binding.id && !crew.includes(r.target_ref))
    .forEach(r => adoptChild(r.target_ref));
}
/* ── THE PROJECT'S MEMORY ARRIVES AFTER THE CACHE DOES ───────────────────────
 *
 * The cached rows are read synchronously, so a reload restores immediately and
 * an offline device still has its own attachments. The project's canonical rows
 * arrive a moment later — and when they do, a window the PROJECT says is
 * attached is bound here, through the same snap and adopt the owner would have
 * used.
 *
 * That ordering is the point. A device that has never opened this project is
 * handed the project's attachments and resumes them; it is never asked to
 * reconstruct what was going on, which is the difference between pairing and
 * remembering.
 */
hydrateAttachmentProjection();
subscribeAttachments(restoreAttachments);

export function registerChatTarget(target) {
  /* A re-registration that declares the same thing is not a change, and the
   * record it replaces is a NEW object — so notifying here woke every reader
   * for a surface that had not moved. `element` is part of the comparison
   * because the dock's "is this surface on screen" claim is read off it. */
  const existing = snapshot.targets.find(t => t.id === target.id);
  const unchanged = existing
    && existing.label === target.label
    && existing.workRef === target.workRef
    && existing.category === target.category
    && existing.coordinate === target.coordinate
    && existing.element === target.element;
  if (!unchanged) {
    snapshot = { ...snapshot, targets: [...snapshot.targets.filter(t => t.id !== target.id), target] };
    restoreAttachments();
    notify();
  }
  return () => {
    const active = snapshot.targets.find(t => t.id === target.id);
    if (active?.element !== target.element) return;
    snapshot = { ...snapshot, targets: snapshot.targets.filter(t => t.id !== target.id) };
    // Closing a surface hides its dock; only explicit Undock releases project context.
    if (snapshot.binding?.id === target.id) snapshot = { ...snapshot, view: 'foreground' };
    notify();
  };
}
export function snapChat(id, { reveal = true, view = 'foreground' } = {}) {
  const target = snapshot.targets.find(t => t.id === id);
  if (!target) throw new Error('TARGET_NOT_OPEN');
  snapshot = { ...transitionChat(snapshot, { type: 'SNAP', target }), open: reveal === true, view: view === 'background' ? 'background' : 'foreground' };
  recordAttach({ target_ref: id, label: target.label, role: 'LEAD' });
  notify();
}
/* `crew` is reset with the binding: `unsnapChat` frees the protocol's crew, and a
   snapshot that kept the old list would go on reporting windows under a lead
   that no longer exists. */
export function detachChat() {
  snapshot = { ...transitionChat(snapshot, { type: 'DETACH' }), crew: [], view: 'foreground' };
  recordDetachAll();
  notify();
}

/* ── THE THREE LANES ─────────────────────────────────────────────────────────
 *
 * A window carries three conversations, one per edge. Each is addressed by the
 * window's own ref PLUS the edge it sits on, so three lanes on one window are
 * three addresses rather than three records competing for one name — see
 * src/lib/chatEdges.mjs for why those three and what each is for.
 *
 * A lane binds through the SAME `recordAttach` the single dock uses, because a
 * lane IS an attachment: the same memory remembers it across a reload, and a
 * second mechanism for "a conversation is bound to a window" is exactly the
 * drift this estate keeps refusing. The only thing the lane adds is the edge in
 * the address.
 *
 * Both refuse by NAME rather than by doing nothing, so a surface offering a lane
 * can say why it refused.
 */
export function snapChatToEdge(id, edge) {
  const target = snapshot.targets.find(t => t.id === id);
  if (!target) throw new Error('TARGET_NOT_OPEN');
  const check = mayBindLane(getChatAttachments(), {
    target_ref: id, edge, conversation_ref: snapshot.conversationRef,
  });
  if (!check.ok) throw new Error(check.first_red);
  recordAttach({ target_ref: edgeRef(id, edge), label: target.label, role: 'LEAD' });
}

export function releaseLane(id, edge) {
  recordDetach(edgeRef(id, edge));
}

/* ── THE CREW ────────────────────────────────────────────────────────────────
 *
 * The window this conversation is docked to is its LEAD. A window adopted under
 * it is its CREW. Adoption and release are store actions rather than component
 * state because the crew is a fact about the conversation: it survives a
 * re-render, a re-snap and a device change, and it is the same crew on a phone
 * as on the desktop — only its SHAPE differs, and that shape is answered by
 * `projectionForDevice` rather than by whoever happens to be drawing.
 *
 * Both refuse by name rather than by doing nothing, so a surface that offers the
 * control can say why it was refused.
 */
export function adoptChild(id) {
  const target = snapshot.targets.find(t => t.id === id);
  if (!target) throw new Error('TARGET_NOT_OPEN');
  const protocol = adoptChildProtocol(snapshot.protocol, id);
  if (!protocol.ok) throw new Error(protocol.first_red);
  snapshot = { ...snapshot, protocol, crew: protocol.crew, generation: snapshot.generation + 1 };
  recordAttach({ target_ref: id, label: target.label, role: 'CHILD' });
  notify();
}

export function releaseChild(id) {
  const protocol = releaseChildProtocol(snapshot.protocol, id);
  if (!protocol.ok) throw new Error(protocol.first_red);
  snapshot = { ...snapshot, protocol, crew: protocol.crew, generation: snapshot.generation + 1 };
  recordDetach(id);
  notify();
}
export function setChatSide(side) {
  const next = side === 'left' ? 'left' : 'right';
  if (snapshot.side === next) return;
  snapshot = { ...snapshot, side: next };
  notify();
}
/* The one writer in this file that had no guard. Its four siblings all bail on a
   no-op write, and the reason is the same for this one: replacing the snapshot
   object is what a reader sees as a change, so an identical write is a re-render
   bought for nothing. */
export function setChatView(view) {
  if (snapshot.view === view) return;
  snapshot = { ...snapshot, view };
  notify();
}
export function setChatDragging(dragging) {
  if (snapshot.dragging === Boolean(dragging)) return;
  snapshot = { ...snapshot, dragging: Boolean(dragging) };
  if (typeof document !== 'undefined') document.body.dataset.chatDragging = dragging ? 'true' : 'false';
  notify();
}
export function setChatOpen(open) { if (snapshot.open !== open) { snapshot = { ...snapshot, open }; notify(); } }

/* One environment address for the conversation. ROOT/BASE/HOME/COMMAND travel
 * together; a partial write is refused so a component cannot silently replace
 * one rail while keeping the other three from an older context. */
export function bindChatEnvironment({ root_ref, base_ref, home_ref, command_ref = 'COMDCCT' } = {}) {
  const next = {
    root_ref: root_ref || null,
    base_ref: base_ref || null,
    home_ref: home_ref || null,
    command_ref: command_ref || null,
  };
  const missing = Object.entries(next).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    return {
      ok: false,
      first_red: 'CHAT_ENVIRONMENT_INCOMPLETE:' + missing.join(','),
      environment: snapshot.environment,
    };
  }
  if (JSON.stringify(snapshot.environment) === JSON.stringify(next)) {
    return { ok: true, environment: snapshot.environment };
  }
  snapshot = { ...snapshot, environment: next };
  notify();
  return { ok: true, environment: next };
}