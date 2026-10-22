import { base44 } from '../api/base44Client.js';

/* ── THE ENTITY-BACKED STORE ─────────────────────────────────────────────────
 *
 * The production end of `createProjectionServer`. It has the same three methods
 * the memory store has, so the mutation logic — and therefore the offline leg
 * and the online leg alike — never learns which one it is talking to. That is
 * the whole reason the store was made pluggable: an adapter swap is not a
 * behaviour change.
 *
 * The key is HOME + project and it is used as the QUERY rather than minted into
 * a synthetic row id. A row is found by the coordinates that define it, so two
 * devices that agree on the coordinates cannot end up holding two rows — which
 * is exactly what a locally-minted id would have allowed, and exactly what
 * "resume the same project" would then have quietly broken.
 *
 * HOME is the owning user's id. It is not a device, not a session and not a
 * project: it is the one coordinate that decides WHOSE environment this is.
 */
const splitKey = (k) => {
  const i = k.indexOf('::');
  return [k.slice(0, i), k.slice(i + 2)];
};

/* The built-ins belong to the row, not to the fact. Sending them back on an
 * update would let a device rewrite the record's own custody metadata. */
const strip = (rec) => {
  const { id, created_date, updated_date, created_by_id, ...body } = rec ?? {};
  return body;
};

export function createEntityStore() {
  const find = async (k) => {
    const [home, project_ref] = splitKey(k);
    const page = await base44.entities.ProjectionBinding.filter({ home, project_ref }, { limit: 1 });
    return (page?.items ?? [])[0] ?? null;
  };

  return {
    get: find,

    async put(k, v) {
      const row = await find(k);
      const body = strip(v);
      return row
        ? base44.entities.ProjectionBinding.update(row.id, body)
        : base44.entities.ProjectionBinding.create(body);
    },

    /* Every binding this HOME holds. A device that changed projects, closed a
     * tab or was reinstalled finds its attachments again by asking for its own
     * HOME — not by remembering which project it was last on. */
    async all(home) {
      if (!home) return [];
      const page = await base44.entities.ProjectionBinding.filter({ home }, { limit: 100 });
      return page?.items ?? [];
    },
  };
}