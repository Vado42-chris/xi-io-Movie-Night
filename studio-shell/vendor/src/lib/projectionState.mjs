/**
 * PROJECTION STATE — the STATE and SYNC atoms.
 *
 * One binding per HOME + project. Every device reads it; no device owns it.
 *
 * The load-bearing decision in this file is that there is exactly ONE
 * implementation of every mutation, and BOTH paths use it:
 *
 *     the wire is up   -> the device applies the mutation to the canonical row
 *     the wire is down -> the device applies the SAME mutation to its own cache
 *                         and queues it
 *
 * Two implementations would be two behaviours that agree until the day they
 * don't, and the day they don't is the day a person is offline. So a mutation is
 * a declared operation, `applyMutation` is a pure function over the binding, and
 * the offline leg and the online leg are the same call.
 *
 * Reconciliation is decided on GENERATION, never on who wrote last. An
 * idempotent re-attach does not advance the generation, which is what stops a
 * reload minting a second identity for one conversation.
 */
import { PROJECTION_SCHEMA, classifyProjection, projectionRole } from './projectionContract.mjs';

let counter = 0;
const mintRef = () => `xiio:projection/${Date.now().toString(36)}-${(counter += 1).toString(36)}`;
const at = () => new Date().toISOString();

/* ── THE MUTATIONS ───────────────────────────────────────────────────────────
 *
 * Declared as data rather than as five near-identical functions, so the hostile
 * and the runtime cannot exercise two different sets of verbs.
 */
export const OP = Object.freeze({
  BIND: 'BIND',
  ATTACH: 'ATTACH',
  DETACH: 'DETACH',
  REATTACH: 'REATTACH',
  SETTING: 'SETTING',
  PRESENCE: 'PRESENCE',
  /* An EFFECT is not a state change to the project — it is the record of work
     performed FOR the project by a HOME other than the one that asked. It is a
     mutation of the conversation's own state for the same reason a setting is:
     the other projections have to be able to read that it happened. */
  EFFECT: 'EFFECT',
});

const uniq = (xs) => [...new Set(xs)];

/**
 * The one implementation. Pure: takes a binding and a mutation, returns the next
 * binding. Nothing here knows whether the caller is online.
 */
export function applyMutation(rec, mutation, { device, session_ref } = {}) {
  if (!rec) return { ok: false, first_red: 'BINDING_REQUIRED' };
  if (!mutation?.op) return { ok: false, first_red: 'OP_REQUIRED', rec };
  if (!Object.values(OP).includes(mutation.op)) {
    return { ok: false, first_red: 'OP_UNKNOWN', rec };
  }

  const stamp = at();
  const advance = (next) => ({
    ok: true,
    rec: {
      ...next,
      generation: (rec.generation ?? 0) + 1,
      updated_at: stamp,
      receipts: [
        ...(rec.receipts ?? []),
        { op: mutation.op, device: device ?? null, session_ref: session_ref ?? null, generation: (rec.generation ?? 0) + 1, at: stamp },
      ],
    },
  });
  /* An accepted mutation that changes nothing returns the binding UNCHANGED —
     no new generation, no receipt. This is the whole anti-duplicate mechanism:
     a reload, a re-snap and a double-tap all land here and all leave one
     identity, one generation and one receipt behind. */
  const unchanged = () => ({ ok: true, rec, idempotent: true });

  switch (mutation.op) {
    case OP.BIND:
      return unchanged();

    case OP.ATTACH: {
      if (!mutation.conversation_ref) return { ok: false, first_red: 'CONVERSATION_REQUIRED', rec };
      if ((rec.conversation_refs ?? []).includes(mutation.conversation_ref)) return unchanged();
      const tools = mutation.tools ?? [];
      return advance({
        ...rec,
        conversation_refs: uniq([...(rec.conversation_refs ?? []), mutation.conversation_ref]),
        tool_refs: uniq([...(rec.tool_refs ?? []), ...tools]),
        /* Re-attaching from history clears it from history: a conversation is
           either attached or remembered, never both. */
        remembered: (rec.remembered ?? []).filter((r) => r.conversation_ref !== mutation.conversation_ref),
      });
    }

    case OP.DETACH: {
      if (!(rec.conversation_refs ?? []).includes(mutation.conversation_ref)) {
        /* NOT ATTACHED — but it may still be REMEMBERED, and editing the tags on
           a remembered record is a real mutation: those tags are the history's
           index, and they are the only thing a later search finds it by. It was
           being refused as idempotent, so tagging a detached conversation
           appeared to work and then could not be found. The record stays where
           it is; only its index changes. */
        const held = (rec.remembered ?? []).find((r) => r.conversation_ref === mutation.conversation_ref);
        const sameTags = JSON.stringify(held?.tags ?? []) === JSON.stringify(mutation.tags ?? held?.tags ?? []);
        if (held && mutation.tags && !sameTags) {
          return advance({
            ...rec,
            remembered: (rec.remembered ?? []).map((r) =>
              r.conversation_ref === mutation.conversation_ref ? { ...r, tags: mutation.tags } : r,
            ),
          });
        }
        return unchanged();
      }
      const entry = (rec.remembered ?? []).find((r) => r.conversation_ref === mutation.conversation_ref);
      const held = entry?.tools ?? mutation.tools ?? [];
      return advance({
        ...rec,
        conversation_refs: (rec.conversation_refs ?? []).filter((r) => r !== mutation.conversation_ref),
        /* Only THIS conversation's tools leave. A detach that rebuilt the tool
           set from the remaining conversations would silently drop a tool two
           conversations share. */
        tool_refs: (rec.tool_refs ?? []).filter((t) => !held.includes(t)),
        remembered: [
          ...(rec.remembered ?? []).filter((r) => r.conversation_ref !== mutation.conversation_ref),
          {
            conversation_ref: mutation.conversation_ref,
            project_ref: rec.project_ref,
            tags: mutation.tags ?? entry?.tags ?? [],
            tools: held,
            detached_at: stamp,
          },
        ],
      });
    }

    case OP.REATTACH: {
      const entry = (rec.remembered ?? []).find((r) => r.conversation_ref === mutation.conversation_ref);
      if (!entry) return { ok: false, first_red: 'NOT_REMEMBERED', rec };
      /* The tools that come back are the tools that left, from the remembered
         record — never re-derived from whatever the registry says today. */
      return advance({
        ...rec,
        conversation_refs: uniq([...(rec.conversation_refs ?? []), entry.conversation_ref]),
        tool_refs: uniq([...(rec.tool_refs ?? []), ...(entry.tools ?? [])]),
        remembered: (rec.remembered ?? []).filter((r) => r.conversation_ref !== entry.conversation_ref),
      });
    }

    case OP.SETTING: {
      if (!mutation.key) return { ok: false, first_red: 'SETTING_KEY_REQUIRED', rec };
      if ((rec.settings ?? {})[mutation.key] === mutation.value) return unchanged();
      return advance({ ...rec, settings: { ...(rec.settings ?? {}), [mutation.key]: mutation.value } });
    }

    case OP.PRESENCE: {
      const legs = rec.projections ?? [];
      const seen = legs.find((l) => l.device === device && l.session_ref === session_ref);
      if (seen) return unchanged();
      const role = projectionRole(device);
      return advance({
        ...rec,
        projections: [
          ...legs,
          { device, role: role.ok ? role.role : null, session_ref, com: mutation.com ?? null, last_seen_at: stamp },
        ],
      });
    }

    /* ── THE EFFECT ──────────────────────────────────────────────────────────
     *
     * Recorded on the CONVERSATION, not on the device that performed it. The
     * phone asks for a build, a qualified personal node performs it, and the
     * receipt lands here — which is why the desktop reads that the build
     * happened without ever having asked for it. An effect recorded only on the
     * executor would be a fact the rest of the environment could not see, and
     * "the conversation is the product" would be a slogan rather than a
     * property.
     *
     * An effect with no named HOME did not route; one with no outcome was never
     * observed. Both are refused rather than filed as a completion. A repeat of
     * the same need_ref is idempotent, so a retried request does not mint a
     * second receipt for one effect.
     */
    case OP.EFFECT: {
      const effect = mutation.effect;
      if (!effect?.need_ref) return { ok: false, first_red: 'EFFECT_NEED_REQUIRED', rec };
      if (!effect?.operation_ref) return { ok: false, first_red: 'EFFECT_OPERATION_REQUIRED', rec };
      if (!effect?.home_ref) return { ok: false, first_red: 'EFFECT_HOME_REQUIRED', rec };
      if (!effect?.outcome) return { ok: false, first_red: 'EFFECT_OUTCOME_REQUIRED', rec };
      if ((rec.effects ?? []).some((e) => e.need_ref === effect.need_ref)) return unchanged();
      return advance({
        ...rec,
        effects: [...(rec.effects ?? []), { ...effect, at: effect.at ?? stamp }],
      });
    }

    default:
      return { ok: false, first_red: 'OP_UNKNOWN', rec };
  }
}

export function newBinding({ home, project_ref, device, session_ref }) {
  if (!home) return { ok: false, first_red: 'HOME_REQUIRED' };
  if (!project_ref) return { ok: false, first_red: 'PROJECT_REQUIRED' };
  const rec = {
    binding_ref: mintRef(),
    schema: PROJECTION_SCHEMA,
    home,
    project_ref,
    conversation_refs: [],
    tool_refs: [],
    settings: {},
    remembered: [],
    projections: [],
    receipts: [],
    effects: [],
    generation: 0,
    updated_at: at(),
  };
  return applyMutation(rec, { op: OP.PRESENCE }, { device, session_ref });
}

/* ── THE SERVER SIDE ─────────────────────────────────────────────────────────
 *
 * `store` is the pluggable end. The production adapter is the ProjectionBinding
 * entity; the hostile's adapter is a map. The logic above never learns which.
 */
export function createProjectionServer({ store }) {
  const key = (home, project_ref) => `${home}::${project_ref}`;

  return {
    async load({ home, project_ref }) {
      const rec = await store.get(key(home, project_ref));
      return rec ?? null;
    },

    async commit({ home, project_ref, mutation, device, session_ref }) {
      const existing = await store.get(key(home, project_ref));
      if (!existing) {
        const fresh = newBinding({ home, project_ref, device, session_ref });
        if (!fresh.ok) return fresh;
        const first = applyMutation(fresh.rec, mutation, { device, session_ref });
        if (!first.ok) return first;
        await store.put(key(home, project_ref), first.rec);
        return first;
      }
      const next = applyMutation(existing, mutation, { device, session_ref });
      if (!next.ok) return next;
      if (!next.idempotent) await store.put(key(home, project_ref), next.rec);
      return next;
    },

    /* Reconciliation. Higher generation wins; an EQUAL generation with differing
       content is DRIFT and is refused rather than resolved by picking one — a
       tie broken by writing order is a silent overwrite of somebody's work. */
    async reconcile({ local, remote }) {
      const verdict = classifyProjection(local, remote);
      if (verdict === 'CONSERVED') return { ok: true, verdict, rec: remote };
      if (verdict === 'HOME_SPLIT') return { ok: false, verdict, first_red: 'HOME_SPLIT' };
      if (verdict === 'PROJECT_SPLIT') return { ok: false, verdict, first_red: 'PROJECT_SPLIT' };

      const lg = local?.generation ?? 0;
      const rg = remote?.generation ?? 0;
      if (lg === rg) return { ok: false, verdict, first_red: 'DRIFT_AT_EQUAL_GENERATION' };
      const winner = lg > rg ? local : remote;
      await store.put(key(winner.home, winner.project_ref), winner);
      return { ok: true, verdict, rec: winner, winner: lg > rg ? 'LOCAL' : 'REMOTE' };
    },
  };
}

/* ── THE DEVICE SIDE ─────────────────────────────────────────────────────────
 *
 * A projection: one leg, one local cache, one queue. It reads HOME; it never
 * becomes HOME. With the wire down it keeps working (local-first) and holds its
 * mutations until it can hand them over, at which point the SAME mutation
 * function is applied to the canonical row.
 */
export function createProjection({ server, device, session_ref, home, project_ref }) {
  let local = null;
  let queue = [];
  let online = true;

  const refuse = (first_red) => ({ ok: false, first_red });

  const read = () => {
    if (!local) return refuse('NOT_OPEN');
    const role = projectionRole(device);
    return {
      ok: true,
      device,
      role: role.ok ? role.role : null,
      canonical: false,
      binding_ref: local.binding_ref,
      home: local.home,
      project_ref: local.project_ref,
      conversation_refs: [...(local.conversation_refs ?? [])],
      tool_refs: [...(local.tool_refs ?? [])],
      settings: { ...(local.settings ?? {}) },
      effects: [...(local.effects ?? [])],
      generation: local.generation,
      pending: queue.length,
    };
  };

  const apply = async (mutation) => {
    if (!local) {
      const opened = await open();
      if (!opened.ok) return opened;
    }
    /* Offline: the same pure function, applied to the cache, queued. */
    const applied = applyMutation(local, mutation, { device, session_ref });
    if (!applied.ok) return applied;
    local = applied.rec;

    if (!online) {
      if (!applied.idempotent) queue = [...queue, mutation];
      return { ok: true, queued: true, rec: local };
    }
    const server_ = await server.commit({ home, project_ref, mutation, device, session_ref });
    if (!server_.ok) return server_;
    /* The canonical row is the truth once the wire is up. Taking the server's
       answer rather than keeping the local one is what stops the two drifting
       apart one mutation at a time. */
    local = server_.rec;
    /* IDEMPOTENCE HAS TO SURVIVE THE WIRE.
     *
     * Whether a mutation changed anything is a fact about the mutation, not
     * about which path carried it — and it was being reported on the offline
     * path and dropped on the online one. So the same re-attach answered
     * "nothing changed" with the wire down and said nothing at all with it up,
     * which is precisely backwards: the online case is the one a reload hits. */
    return { ok: true, rec: local, idempotent: applied.idempotent === true || server_.idempotent === true };
  };

  async function open() {
    if (!online) {
      return local ? { ok: true, rec: local, offline: true } : refuse('UNOBSERVED_OFFLINE');
    }
    const rec = await server.load({ home, project_ref });
    if (rec) {
      local = rec;
      /* The presence commit's ANSWER is taken, not discarded.
       *
       * A device opening the project for the first time is a NEW leg, and a new
       * leg advances the record — so the binding just loaded is already one
       * generation behind the one the commit produced. Discarding that answer
       * left a freshly-opened projection reporting a stale generation until its
       * next read, which is exactly the state a "same generation" check looks
       * at. */
      const committed = await server.commit({ home, project_ref, mutation: { op: OP.PRESENCE }, device, session_ref });
      if (committed.ok) local = committed.rec;
      return { ok: true, rec: local };
    }
    const created = await server.commit({ home, project_ref, mutation: { op: OP.PRESENCE }, device, session_ref });
    if (!created.ok) return created;
    local = created.rec;
    return { ok: true, rec: local };
  }

  return {
    open,
    view: read,
    /* The device's own cached record, whole. `view` is a partial by design —
       it is what a SURFACE is shown — but a projection that has to derive its
       own rows (the attachment memory does) needs the parts the view leaves
       out, and re-reading them from the server would make every local edit a
       round trip. */
    snapshot: () => (local ? JSON.parse(JSON.stringify(local)) : null),
    attachChat: ({ conversation_ref, tools }) => apply({ op: OP.ATTACH, conversation_ref, tools }),
    /* `tags` travels with the detach: they are the meta tags the history is
       searched by, and dropping them here would leave a detached conversation
       findable by nothing. */
    detachChat: ({ conversation_ref, tools, tags }) => apply({ op: OP.DETACH, conversation_ref, tools, tags }),
    reattach: ({ conversation_ref }) => apply({ op: OP.REATTACH, conversation_ref }),
    setSetting: ({ key, value }) => apply({ op: OP.SETTING, key, value }),
    /* Work performed for this conversation by another HOME. The device that ASKS
       records it, because the asker is the one holding the conversation when the
       receipt lands. */
    recordEffect: ({ need_ref, operation_ref, home_ref, outcome, receipt_ref }) =>
      apply({ op: OP.EFFECT, effect: { need_ref, operation_ref, home_ref, outcome, receipt_ref } }),
    setOnline: (next) => { online = !!next; return { ok: true, online }; },
    isOnline: () => online,
    pending: () => [...queue],
    /* Search history. Served from the canonical row, so a phone finds what a
       desktop detached — a per-device history would find only its own. */
    searchHistory: ({ project_ref: p, tag } = {}) => {
      if (!local) return refuse('NOT_OPEN');
      const hits = (local.remembered ?? []).filter(
        (r) => (!p || r.project_ref === p) && (!tag || (r.tags ?? []).includes(tag)),
      );
      return { ok: true, hits };
    },
    /* Coming back online: hand the queue over in order, then reconcile. The
       reconciliation is what proves no second identity was minted while the
       wire was down. */
    async reconnect() {
      online = true;
      const flushed = [];
      for (const mutation of queue) {
        const res = await server.commit({ home, project_ref, mutation, device, session_ref });
        if (!res.ok) return { ok: false, first_red: res.first_red, flushed };
        local = res.rec;
        flushed.push(mutation.op);
      }
      queue = [];
      const remote = await server.load({ home, project_ref });
      const verdict = await server.reconcile({ local, remote });
      if (!verdict.ok) return { ok: false, first_red: verdict.first_red, verdict: verdict.verdict, flushed };
      local = verdict.rec;
      return { ok: true, verdict: verdict.verdict, flushed, rec: local };
    },
  };
}

/* ── STORES ──────────────────────────────────────────────────────────────────
 *
 * A map, for the hostiles and for a device that is working entirely locally.
 * The browser adapter for the entity plane is the same three methods.
 */
export function createMemoryStore() {
  const rows = new Map();
  return {
    async get(k) { return rows.get(k) ?? null; },
    async put(k, v) { rows.set(k, JSON.parse(JSON.stringify(v))); return v; },
    async all() { return [...rows.values()]; },
  };
}