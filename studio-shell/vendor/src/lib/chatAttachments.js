import { useSyncExternalStore } from 'react';
import { base44 } from '../api/base44Client.js';
import { DEVICE } from './chatSnap.mjs';
import { createProjection, createProjectionServer } from './projectionState.mjs';
import { createEntityStore } from './projectionBindingStore.js';
import { declaredToolsForTarget } from './attachedTools.js';
import { parseEdgeRef } from './chatEdges.mjs';

/* ── THE ATTACHMENT MEMORY, AS A PROJECTION OF THE CANONICAL ROW ─────────────
 *
 * This file used to BE the attachment state: one array in browser storage, keyed
 * by window address, with no user and no project anywhere in it. That is a
 * device-local truth wearing the word "attachment", and it breaks the pairing in
 * the one way that cannot be papered over — two devices each hold a list, the
 * lists agree only while the person is standing still, and neither is the
 * project's.
 *
 * What is canonical is the ProjectionBinding row, keyed by HOME and project.
 * This file is a PROJECTION of it: it holds the device's cached copy, it renders
 * that copy into the record shape the drawer already reads, and every write goes
 * through the one mutation function in projectionState — online straight to the
 * row, offline to the cache with the mutation queued, and the SAME call either
 * way.
 *
 * So the exported names are unchanged and the drawer did not have to be
 * rewritten. What changed is where the truth lives:
 *
 *     before   browser storage  →  the drawer
 *     now      the canonical row →  this cache →  the drawer
 *
 * The record shape is unchanged too, because a UI that had to learn a new shape
 * to gain a property it already displayed would be a UI that gained nothing.
 *
 *     target_ref    the window address. This IS the conversation_ref the binding
 *                   carries: one window, one conversation, one identity — not a
 *                   second name for the same thing.
 *     role          LEAD or CHILD, held on the binding as per-conversation meta
 *                   so the phone reads the same lead the desktop set.
 *     project_id    the real Project record. It decides WHICH BINDING the record
 *                   lives in, which is what makes "resume the same project"
 *                   possible on a device that has never opened it.
 *     tags          the history's index, written when the conversation is let go.
 *     attached      true while it is in the binding's conversation_refs.
 */

const KEY = 'xiio:chat-attachments:v2';
const SESSION_KEY = 'xiio:projection-session';

/* A chat that has not been filed yet is not projectless — it is UNFILED, which
   is a coordinate and is named as one. Defaulting it into some project would
   file a person's work under something they never chose. */
const UNFILED = 'UNFILED';
const bucketFor = (project_id) => project_id || UNFILED;
const META = (ref) => `attach:${ref}`;
const PROJ = (ref) => `project:${ref}`;

const now = () => new Date().toISOString();

/* The device, read without a hook because this module is not a component. It
   mirrors useDeviceShape exactly, from the one declaration of the three devices. */
const deviceShape = () =>
  typeof window === 'undefined'
    ? DEVICE.DESKTOP
    : window.matchMedia('(min-width: 1024px)').matches
      ? DEVICE.DESKTOP
      : window.matchMedia('(min-width: 768px)').matches
        ? DEVICE.TABLET
        : DEVICE.MOBILE;

/* A device session, not a page load. Kept in storage so reloading a phone does
   not mint a second leg of the same phone on the record — presence is meant to
   say which devices are connected, and a list that grows on every refresh says
   only how many times somebody pressed reload. */
function sessionRef() {
  if (typeof window === 'undefined') return 'sess:server';
  try {
    const held = window.localStorage.getItem(SESSION_KEY);
    if (held) return held;
    const minted = `sess:${deviceShape().toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    window.localStorage.setItem(SESSION_KEY, minted);
    return minted;
  } catch {
    return `sess:${deviceShape().toLowerCase()}-${Date.now().toString(36)}`;
  }
}

const SESSION = sessionRef();
const store = createEntityStore();
const server = createProjectionServer({ store });

/* ── THE LOCAL LEG ───────────────────────────────────────────────────────────
 *
 * Still browser storage, and now honestly so: it is the CACHE, the thing that
 * makes a cold start instant and an offline device keep working. It is no longer
 * the truth, and nothing reads it as if it were.
 */
function load() {
  if (typeof window === 'undefined') return [];
  try {
    window.localStorage.removeItem('xiio:chat-attachments');
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((r) => r && r.target_ref) : [];
  } catch {
    return [];
  }
}

let list = load();
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const subscribeAttachments = subscribe;

/* ── A COMMIT THAT SAYS NOTHING NEW IS NOT A COMMIT ──────────────────────────
 *
 * This notified unconditionally: it replaced the list and woke every listener on
 * every call, even when `next` carried the same facts as the list already held.
 * That is not a no-op, because a listener cannot see that the content is equal —
 * it sees a NEW array, and a new array is a changed snapshot to
 * useSyncExternalStore, which is a render.
 *
 * The fan-out is what made it expensive. `syncFromCanonical` runs on EVERY push
 * completion and rebuilds the rows from the bindings, so one `recordAttach` —
 * which issues two or three pushes — produced a notify per push, each with a
 * freshly mapped array carrying the same rows. And `restoreAttachments` is
 * subscribed here, so every one of those notifies re-entered the attachment
 * writer through snapChat/adoptChild, which committed again from inside the
 * outer notify's own loop.
 *
 * The comparison is the serialisation this function already performs for
 * persistence, so the guard costs no extra work: stringify once, compare, and
 * store the same string. An identical write now ends here instead of fanning
 * out, and `syncFromCanonical` needs no guard of its own — it is this one.
 */
let committed = JSON.stringify(list);

function commit(next) {
  const serial = JSON.stringify(next);
  if (serial === committed) return;
  committed = serial;
  list = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, serial);
    } catch {
      /* A full or blocked store costs persistence, not the attachment: the list
         in memory is still the truth for this session, and the canonical row is
         still the truth beyond it. */
    }
  }
  listeners.forEach((fn) => fn());
}

export const getChatAttachments = () => list;
export const useChatAttachments = () =>
  useSyncExternalStore(subscribe, getChatAttachments, getChatAttachments);

/* ── HOME, AND ONE CLIENT PER PROJECT ────────────────────────────────────────
 *
 * A device is a leg of one environment, so it holds ONE HOME and one leg per
 * project it has touched — never one per device, which is the whole failure.
 */
let home = null;
let activeProject = { id: null, name: null };
let hydrated = false;
const clients = new Map();

async function clientFor(bucket) {
  if (!home) return { ok: false, first_red: 'HOME_REQUIRED' };
  let client = clients.get(bucket);
  if (!client) {
    client = createProjection({ server, device: deviceShape(), session_ref: SESSION, home, project_ref: bucket });
    clients.set(bucket, client);
  }
  const opened = await client.open();
  return opened.ok ? { ok: true, client } : opened;
}

/* ── DERIVING THE ROWS FROM THE ROW ────────────────────────────────────────
 *
 * The one piece of local logic, and it is a RENDER, not a rule: nothing here
 * decides what is attached, it reads what the binding says and puts it in the
 * shape the drawer draws. That is why there is no second mutation
 * implementation to drift from the first.
 */
function recordsFrom(rec) {
  if (!rec) return [];
  const project_id = rec.project_ref === UNFILED ? null : rec.project_ref;
  const project_name = rec.settings?.[PROJ(rec.project_ref)]?.project_name ?? null;
  const metaOf = (ref) => rec.settings?.[META(ref)] ?? {};

  return [
    ...(rec.conversation_refs ?? []).map((ref) => ({
      target_ref: ref,
      label: metaOf(ref).label ?? ref,
      role: metaOf(ref).role ?? 'CHILD',
      project_id,
      project_name,
      tags: [],
      attached: true,
      updated_at: rec.updated_at ?? null,
    })),
    ...(rec.remembered ?? []).map((r) => ({
      target_ref: r.conversation_ref,
      label: metaOf(r.conversation_ref).label ?? r.conversation_ref,
      role: metaOf(r.conversation_ref).role ?? 'CHILD',
      project_id,
      project_name,
      tags: r.tags ?? [],
      attached: false,
      updated_at: r.detached_at ?? rec.updated_at ?? null,
    })),
  ];
}

/* Replace the cache with what the bindings actually say. Skipped while no client
   is open, so a device that has not reached HOME keeps its cached rows instead
   of being emptied by an empty derivation. */
function syncFromCanonical() {
  if (!clients.size) return;
  const rows = [];
  for (const client of clients.values()) rows.push(...recordsFrom(client.snapshot()));
  /* ── A ROW THE CANONICAL LEG HAS NEVER HEARD OF IS NOT A ROW IT DELETED ────
   *
   * This committed the canonical rows and nothing else. So a chat the person had
   * attached — recorded locally, cached, bound in the dock — was ERASED the moment
   * hydration finished if the canonical write for it had failed or had not
   * landed: the derivation came back without it, and the cache was overwritten
   * with the shorter list. On the next reload there was nothing left to restore,
   * which from the outside is a chat that does not stay attached.
   *
   * Absence is not deletion. A detach never removes a conversation from the
   * canonical row — it moves it to `remembered` — so a locally attached ref that
   * the canonical rows do not mention at all is one the canonical leg was never
   * told about. It is kept until the wire has actually heard it. */
  const heard = new Set(rows.map((r) => r.target_ref));
  const unheard = list.filter((r) => r.attached && !heard.has(r.target_ref));
  commit([...rows, ...unheard]);
}

/* Every write goes here. Optimistic commit first, canonical second: the person
   sees the attachment immediately, and the row catches up. If the wire is down
   the client is switched offline and holds the mutation — the same mutation,
   handed over later by the same function. */
function push(bucket, fn) {
  Promise.resolve()
    .then(() => clientFor(bucket))
    .then((got) => (got.ok ? fn(got.client) : got))
    .then((res) => {
      if (res && res.ok === false) {
        const client = clients.get(bucket);
        if (client) client.setOnline(false);
      }
      syncFromCanonical();
    })
    .catch(() => {
      const client = clients.get(bucket);
      if (client) client.setOnline(false);
    });
}

/* ── REACHING HOME ───────────────────────────────────────────────────────────
 *
 * Called once when the dock store loads. It resolves HOME from the signed-in
 * user and reads back every binding that user holds — so a device that has never
 * seen this project is handed the project's attachments rather than being asked
 * to rebuild them. A failure here is not fatal: the cached rows stand and the
 * wire is retried on the next write.
 */
export async function hydrateAttachmentProjection() {
  if (hydrated) return { ok: true, already: true };
  try {
    const me = await base44.auth.me();
    home = me?.id ?? null;
    if (!home) return { ok: false, first_red: 'HOME_REQUIRED' };
    const rows = await store.all(home);
    for (const rec of rows) {
      const client = createProjection({
        server,
        device: deviceShape(),
        session_ref: SESSION,
        home,
        project_ref: rec.project_ref,
      });
      clients.set(rec.project_ref, client);
      await client.open();
    }
    hydrated = true;
    syncFromCanonical();
    return { ok: true, bindings: rows.length, home };
  } catch {
    return { ok: false, first_red: 'WIRE_DOWN' };
  }
}

/* ── THE WRITES ──────────────────────────────────────────────────────────────
 *
 * The names and signatures the drawer already calls. Nothing below decides
 * whether a mutation changed anything — that is the binding's answer, and it is
 * the same answer on both legs.
 */
export function recordAttach({ target_ref, label, role, tools }) {
  if (!target_ref) return;
  const prior = list.find((r) => r.target_ref === target_ref);
  const project_id = prior?.project_id ?? activeProject.id ?? null;
  const bucket = bucketFor(project_id);
  const name = label || prior?.label || target_ref;
  const tool_refs = tools ?? declaredToolsForTarget(target_ref);

  /* One conversation has one lead — per PROJECT, because a lead is a claim on
     the project's rail and two projects are two rails. A new lead takes the
     seat; the old one is let go through the same detach the person would use,
     so it lands in the history rather than vanishing. */
  /* ── ONE LEAD PER RAIL, AND ONE PER LANE ──────────────────────────────────
   *
   * A lead is a claim on the project's rail, so a new lead takes the seat. The
   * eviction is scoped by EDGE now, because a window carries up to three
   * conversations and they are not competing for one seat: a lane on the top
   * edge must not evict the lane on the bottom edge of the same window.
   *
   * The scope is read off the ADDRESS rather than off a second field, so a ref
   * carries its own edge and nothing has to be kept in step with it. Existing
   * records carry a bare window ref, so their edge is null on both sides of the
   * comparison and their behaviour is exactly what it was. */
  if (role === 'LEAD') {
    const edge = parseEdgeRef(target_ref).edge;
    list
      .filter((r) => r.attached && r.role === 'LEAD' && r.target_ref !== target_ref
        && parseEdgeRef(r.target_ref).edge === edge
        && bucketFor(r.project_id) === bucket)
      .forEach((r) => push(bucket, (c) => c.detachChat({ conversation_ref: r.target_ref, tags: r.tags })));
  }

  commit([
    ...list.filter((r) => r.target_ref !== target_ref),
    {
      target_ref,
      label: name,
      role,
      project_id,
      project_name: prior?.project_name ?? activeProject.name ?? null,
      tags: prior?.tags ?? [],
      attached: true,
      updated_at: now(),
    },
  ]);

  push(bucket, (c) => c.attachChat({ conversation_ref: target_ref, tools: tool_refs }));
  push(bucket, (c) => c.setSetting({ key: META(target_ref), value: { label: name, role } }));
  if (activeProject.name) {
    push(bucket, (c) => c.setSetting({ key: PROJ(bucket), value: { project_name: activeProject.name } }));
  }
}

export function recordDetach(target_ref) {
  const held = list.find((r) => r.target_ref === target_ref && r.attached);
  if (!held) return;
  commit(list.map((r) => (r.target_ref === target_ref ? { ...r, attached: false, updated_at: now() } : r)));
  push(bucketFor(held.project_id), (c) => c.detachChat({ conversation_ref: target_ref, tags: held.tags }));
}

/* Undocking releases the crew with the lead, so the records follow: a free
   conversation leads nothing. */
export function recordDetachAll() {
  const attached = list.filter((r) => r.attached);
  if (!attached.length) return;
  commit(list.map((r) => (r.attached ? { ...r, attached: false, updated_at: now() } : r)));
  attached.forEach((r) => push(bucketFor(r.project_id), (c) => c.detachChat({ conversation_ref: r.target_ref, tags: r.tags })));
}

/* ── FILING, AND TAGGING ─────────────────────────────────────────────────────
 *
 * Filing a chat under a project MOVES it: it leaves the old project's binding
 * and joins the new one. Leaving a copy behind would be one chat filed twice,
 * and the copy would be the one a search found.
 */
export function setAttachmentMeta(target_ref, patch) {
  const prior = list.find((r) => r.target_ref === target_ref);
  if (!prior) return;

  const next = { ...prior, ...patch, updated_at: now() };
  const moved =
    Object.prototype.hasOwnProperty.call(patch, 'project_id') &&
    (patch.project_id ?? null) !== (prior.project_id ?? null);

  if (moved) activeProject = { id: patch.project_id ?? null, name: patch.project_name ?? null };

  commit([...list.filter((r) => r.target_ref !== target_ref), next]);

  const from = bucketFor(prior.project_id);
  const to = bucketFor(next.project_id);

  if (moved) {
    push(from, (c) => c.detachChat({ conversation_ref: target_ref, tags: prior.tags }));
    push(to, (c) => c.attachChat({ conversation_ref: target_ref, tools: declaredToolsForTarget(target_ref) }));
  }

  push(to, (c) => c.setSetting({ key: META(target_ref), value: { label: next.label, role: next.role } }));
  if (next.project_name) {
    push(to, (c) => c.setSetting({ key: PROJ(to), value: { project_name: next.project_name } }));
  }

  /* A tag on a REMEMBERED record is an edit to the history's index, and it has
     to reach the row that the search reads — otherwise tagging a detached
     conversation looks like it worked and it can never be found. */
  if (patch.tags && !prior.attached) {
    push(to, (c) => c.detachChat({ conversation_ref: target_ref, tags: patch.tags }));
  }
}