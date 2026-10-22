/* WINDOW FORMATION · xiio.window-formation/v1
 *
 * The 5s membrane for a desktop work surface.
 *
 * A window is a micro of the estate only when its HOME, lead conversation,
 * crew, principals and proof state travel together. Window membership and
 * approval membership are deliberately distinct:
 *
 *   CREW = windows/surfaces working under one lead chat
 *   PRINCIPALS = admitted humans/AI workers/NANNYs owing proof/readback
 *
 * Several visible chats are not quorum. Several agreeing chats are not quorum.
 * Compound approval owns quorum: proofs multiply; one zero keeps the formation
 * NOT_ADMITTED.
 */

import { approve } from './compoundApproval.mjs';

export const WINDOW_FORMATION_SCHEMA = 'xiio.window-formation/v1';
export const WINDOW_FORMATION_SCALE = '5s';

const clean = (v) => String(v ?? '').trim();
const unique = (xs) => [...new Set((xs || []).map(clean).filter(Boolean))];

export const CHAT_SLOT = Object.freeze({ TOP:'TOP', LEFT:'LEFT', BOTTOM:'BOTTOM' });

export function formationRef({ root_ref, home_ref, target_ref, conversation_ref } = {}) {
  const root = clean(root_ref) || 'root:unbound';
  const home = clean(home_ref) || clean(target_ref) || 'home:unbound';
  const target = clean(target_ref) || clean(conversation_ref) || 'target:unbound';
  return `formation:${root}:${home}:${target}`;
}

function normalizeSlots(conversation_slots = {}, conversation_ref = null) {
  const slots = {};
  for (const slot of Object.values(CHAT_SLOT)) {
    const ref = clean(conversation_slots?.[slot] ?? conversation_slots?.[slot.toLowerCase()]);
    if (ref) slots[slot] = ref;
  }
  if (!Object.keys(slots).length && clean(conversation_ref)) slots.LEFT = clean(conversation_ref);
  return slots;
}

export function principalProof(row = {}) {
  const ref = clean(row.principal_ref || row.worker_ref || row.ref);
  const admitted = row.admitted === true && Boolean(clean(row.session_ref));
  const returned = row.returned === true;
  const readback = row.readback === true && Boolean(clean(row.readback_ref));
  return {
    ref: ref || 'principal:unbound',
    proves: [
      {
        ref: 'admission',
        proved: admitted,
        evidence_ref: clean(row.session_ref) || null,
        whole_note_visible: admitted,
        visible_readback_ref: admitted ? `formation:admission:${ref}` : null,
        first_red: admitted ? null : 'WORKER_OR_SESSION_NOT_ADMITTED',
      },
      {
        ref: 'return',
        proved: returned,
        evidence_ref: clean(row.return_ref) || null,
        whole_note_visible: returned,
        visible_readback_ref: returned ? `formation:return:${ref}` : null,
        first_red: returned ? null : 'RETURN_NOT_OBSERVED',
      },
      {
        ref: 'readback',
        proved: readback,
        evidence_ref: clean(row.readback_ref) || null,
        whole_note_visible: readback,
        visible_readback_ref: readback ? `formation:readback:${ref}` : null,
        first_red: readback ? null : 'INDEPENDENT_READBACK_NOT_OBSERVED',
      },
    ],
  };
}

export function compileWindowFormation({
  root_ref = null,
  base_ref = null,
  home_ref = null,
  target_ref = null,
  work_ref = null,
  conversation_ref = null,
  conversation_slots = {},
  generation = 0,
  crew = [],
  requested_principals = [],
  principals = [],
} = {}) {
  const lead = clean(target_ref);
  const slots = normalizeSlots(conversation_slots, conversation_ref);
  const slotRefs = Object.values(slots);
  const duplicateSlotRefs = slotRefs.filter((ref, i) => slotRefs.indexOf(ref) !== i);
  const crewRefs = unique(crew).filter((ref) => ref !== lead);
  const requested = unique(requested_principals);
  const principalRowsRaw = (principals || []).map(principalProof);
  const principalRows = [];
  const duplicatePrincipals = [];
  const seenPrincipals = new Set();
  for (const row of principalRowsRaw) {
    if (seenPrincipals.has(row.ref)) duplicatePrincipals.push(row.ref);
    else { seenPrincipals.add(row.ref); principalRows.push(row); }
  }
  const approval = approve({
    ref: formationRef({ root_ref, home_ref, target_ref, conversation_ref }),
    principals: principalRows,
  });

  const missing = [];
  if (!clean(root_ref)) missing.push('ROOT');
  if (!clean(home_ref) && !lead) missing.push('HOME');
  if (!slotRefs.length) missing.push('CHAT_SLOT');
  if (!lead) missing.push('LEAD_WINDOW');

  const slotFirstRed = duplicateSlotRefs.length
    ? `DUPLICATE_CONVERSATION_SLOT_IDENTITY:${unique(duplicateSlotRefs).join(',')}`
    : null;
  const principalFirstRed = duplicatePrincipals.length
    ? `DUPLICATE_PRINCIPAL_IDENTITY:${unique(duplicatePrincipals).join(',')}`
    : null;

  const state = missing.length
    ? 'HALF_WIRED'
    : slotFirstRed || principalFirstRed
      ? 'NO_QUORUM'
      : approval.state === 'ADMITTED'
        ? 'QUORUM'
        : 'NO_QUORUM';

  return Object.freeze({
    schema: WINDOW_FORMATION_SCHEMA,
    scale: WINDOW_FORMATION_SCALE,
    formation_ref: formationRef({ root_ref, home_ref, target_ref, conversation_ref }),
    generation,
    root_ref: clean(root_ref) || null,
    base_ref: clean(base_ref) || null,
    home_ref: clean(home_ref) || lead || null,
    work_ref: clean(work_ref) || null,
    lead: {
      conversation_ref: slots.LEFT || slots.TOP || slots.BOTTOM || null,
      target_ref: lead || null,
    },
    conversation_slots: {
      TOP: slots.TOP || null,
      LEFT: slots.LEFT || null,
      BOTTOM: slots.BOTTOM || null,
    },
    conversation_count: slotRefs.length,
    crew: crewRefs,
    crew_size: crewRefs.length,
    requested_principals: requested,
    requested_count: requested.length,
    admitted_principals: principalRows.filter((p) => p.proves[0].proved).map((p) => p.ref),
    admitted_count: principalRows.filter((p) => p.proves[0].proved).length,
    duplicate_principals: unique(duplicatePrincipals),
    quorum: {
      state: approval.state,
      product: approval.product,
      equation: approval.equation,
      principals: approval.principals,
      proved: approval.proved,
      missing: approval.missing,
      first_red: approval.first_red,
    },
    state,
    missing,
    first_red: missing.length
      ? `FORMATION_INPUT_INCOMPLETE:${missing.join(',')}`
      : slotFirstRed || principalFirstRed || approval.first_red,
    effect_authority: 0,
    hard: [
      'WINDOW_CREW!=APPROVAL_PRINCIPALS',
      'VISIBLE_CHAT!=ADMITTED_WORKER',
      'REQUESTED_PRINCIPAL!=ADMITTED_PRINCIPAL',
      'CONSENSUS!=QUORUM',
      'ONE_MISSING_READBACK_ZEROES_THE_PRODUCT',
      'DUPLICATE_PRINCIPAL!=INDEPENDENT_QUORUM',
      'ONE_CONVERSATION!=THREE_SLOTS',
      'TOP_LEFT_BOTTOM_SLOTS_SHARE_ONE_TARGET',
      '5s_HOME!=1s_SURFACE',
    ],
  });
}