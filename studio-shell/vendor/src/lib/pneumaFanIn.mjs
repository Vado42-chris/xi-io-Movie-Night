/* ─────────────────────────────────────────────────────────────────────────────
   PNEUMA HYBRID FAN-IN — the candidate, as a thing the app can actually run.

   The skill package declares the procedure and ships a validator that checks a
   fixture. Neither of those is a runtime: a validator that reads a file proves
   the file, and the package says so itself in its own last line —
   SKILL_PACKAGE_EXISTS != SKILL_RUNTIME_CONSUMED.

   This is the runtime half. It is the same procedure, expressed as a function
   the app calls, so the rules stop being prose and start refusing:

     CONSENSUS != TRUTH
     PROVIDER_CONFIDENCE != EVIDENCE
     TOOL_CALL_TEXT != EFFECT
     MULTI_AGENT_AGREEMENT != NATIVE_READBACK
     SAME_WORDS != INDEPENDENT_EVIDENCE
     CONTRADICTION -> STATE_CONFLICT_OR_TRUE_WAIT

   The load-bearing rule is fail-closed promotion: a return may only carry
   native/runtime credit if its evidence is a NATIVE_RUNTIME_READBACK. Everything
   weaker is held as UNVERIFIED or TRUE_WAIT, never averaged up. That single rule
   is what makes the fan-in worth having — without it, three agents agreeing in
   prose becomes a green.
   ───────────────────────────────────────────────────────────────────────────── */

export const EVIDENCE_RANK = Object.freeze({
  NATIVE_RUNTIME_READBACK: 6,
  PROVIDER_READBACK: 5,
  SOURCE_MUTATION: 4,
  SOURCE_TEXT: 3,
  TOOL_CALL_TEXT: 2,
  NARRATIVE: 1,
  UX_NANNY_SIGNAL: 0,
});

/* The classes a claim can be split into. Declared so a return carrying a class
   outside the set is refused rather than silently ranked as nothing. */
export const CLAIM_CLASSES = Object.freeze([
  'TEMPLATE_OR_PLAN',
  'TOOL_CALL_TEXT',
  'SOURCE_MUTATION',
  'PROVIDER_READBACK',
  'NATIVE_RUNTIME_READBACK',
  'UX_NANNY_SIGNAL',
]);

export const SELECTION = Object.freeze({
  SELECTED: 'SELECTED',
  HELD: 'HELD',
  REJECTED: 'REJECTED',
});

/** A claim is the same claim when its words are the same — that is all
 *  `SAME_WORDS` can mean. Whether it is the same FACT is a separate question,
 *  answered by whether the two returns rest on independent evidence. */
const normalise = (claim) =>
  String(claim || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Fan in heterogeneous provider returns.
 *
 * @param {Array} returns  each: { provider, claim, evidence_class, evidence_ref?, runtime_credit? }
 * @returns the durable return: what was selected, what was held, what was
 *          rejected, the first red, and the two counts the A/B run is scored on.
 */
export function fanIn(returns = []) {
  const selected = [];
  const held = [];
  const rejected = [];
  const reds = [];

  /* The evidence a return actually carries. The field is `evidence` — a list of
     the concrete things that stand behind the claim: a commit, a build exit, a
     lease check, a rejected overreach. A single `evidence_ref` is accepted too,
     because a return that binds one artifact is binding evidence just the same;
     what is refused is a claim with neither. */
  const boundEvidence = (entry) => {
    if (Array.isArray(entry?.evidence)) return entry.evidence.filter(Boolean);
    if (entry?.evidence_ref) return [entry.evidence_ref];
    return [];
  };

  for (const entry of returns) {
    const provider = entry?.provider || '(unnamed)';
    const rank = EVIDENCE_RANK[entry?.evidence_class];

    /* An unknown class is not rank zero. Rank zero is a real, declared class
       (UX_NANNY_SIGNAL); an unknown one is a return the procedure cannot place,
       so it is refused rather than filed as the weakest thing. */
    if (rank === undefined) {
      rejected.push({ ...entry, why: `UNKNOWN_EVIDENCE_CLASS "${entry?.evidence_class}"` });
      reds.push(`${provider}: UNKNOWN_EVIDENCE_CLASS "${entry?.evidence_class}"`);
      continue;
    }

    const evidence = boundEvidence(entry);

    /* A return that names its own disqualification is quarantined. `reasons` is
       the provider's own list of independent checks that failed — a return
       which does that has already told us it cannot stand, and re-deriving that
       here would be a second, weaker opinion. `reason` is the single-reason
       form: an unqualified candidate, held rather than struck out. */
    if (Array.isArray(entry?.reasons) && entry.reasons.length) {
      rejected.push({ ...entry, rank, state: 'QUARANTINE', why: entry.reasons[0] });
      reds.push(`${provider}: QUARANTINE_NONSELECTABLE — ${entry.reasons[0]}`);
      continue;
    }
    if (entry?.reason) {
      held.push({ ...entry, rank, state: 'UNQUALIFIED_CANDIDATE', why: entry.reason });
      continue;
    }

    /* FAIL-CLOSED PROMOTION. The one rule the whole procedure rests on. */
    const wantsCredit = Number(entry?.runtime_credit) > 0;
    if (wantsCredit && entry.evidence_class !== 'NATIVE_RUNTIME_READBACK') {
      held.push({
        ...entry,
        rank,
        state: 'TRUE_WAIT',
        why: `runtime credit refused: ${entry.evidence_class} is not a native readback`,
      });
      reds.push(
        `${provider}: UNSUPPORTED_RUNTIME_PROMOTION — asked for runtime credit on ${entry.evidence_class}`
      );
      continue;
    }

    /* A grounding signal is about the human's cognitive load, not the machine's
       state. It is held as such and can never read as a technical pass. */
    if (entry.evidence_class === 'UX_NANNY_SIGNAL') {
      held.push({
        ...entry,
        rank,
        state: 'N_A_TECHNICAL',
        why: 'grounding signal — carries no technical claim',
      });
      continue;
    }

    /* Evidence has to be bound to the claim. A claim with nothing behind it is
       UNVERIFIED — which is neither false nor PASS, and is never dropped. */
    if (!evidence.length && rank < EVIDENCE_RANK.PROVIDER_READBACK) {
      held.push({
        ...entry,
        rank,
        state: 'UNVERIFIED',
        why: 'no evidence is bound to this claim',
      });
      continue;
    }

    selected.push({
      ...entry,
      rank,
      evidence,
      /* Source can be green while runtime is still open — those are two
         different facts and the state says both rather than collapsing them. */
      state:
        entry.evidence_class === 'NATIVE_RUNTIME_READBACK'
          ? 'PASS'
          : rank >= EVIDENCE_RANK.SOURCE_MUTATION
            ? 'SOURCE_GREEN_RUNTIME_OPEN'
            : 'UNVERIFIED_EFFECT',
    });
  }

  /* SAME WORDS != INDEPENDENT EVIDENCE.
   *
   * Two providers saying the same sentence is two occurrences, not two votes.
   * They only become corroboration when their evidence is independent — a
   * different ref each. This is counted and reported rather than collapsed,
   * because the collapse is the consensus theatre the procedure exists to
   * prevent. */
  const byClaim = new Map();
  for (const row of [...selected, ...held]) {
    const key = normalise(row.claim);
    if (!key) continue;
    if (!byClaim.has(key)) byClaim.set(key, []);
    byClaim.get(key).push(row);
  }

  const occurrences = [];
  for (const [, rows] of byClaim) {
    if (rows.length < 2) continue;
    const refs = new Set(rows.flatMap((r) => (Array.isArray(r.evidence) ? r.evidence : [])).filter(Boolean));
    occurrences.push({
      claim: rows[0].claim,
      providers: rows.map((r) => r.provider),
      independent: refs.size >= 2,
      evidence: [...refs],
      /* Named as occurrences, never as a tally of agreement. */
      occurrences: rows.length,
      votes: refs.size >= 2 ? rows.length : 0,
    });
  }

  const conflicting = occurrences.filter((o) => !o.independent);
  for (const o of conflicting) {
    reds.push(
      `${o.providers.join(', ')}: SAME_WORDS_NOT_INDEPENDENT_EVIDENCE — ${o.occurrences} occurrences, 0 votes`
    );
  }

  /* Native runtime is only ever admitted by a native readback. Where none
     arrived, the honest answer is that it is still waiting — not that it is
     fine, and not that it is false. */
  const nativeReadbacks = selected.filter((r) => r.evidence_class === 'NATIVE_RUNTIME_READBACK');
  const native_runtime = nativeReadbacks.length ? 'READBACK_PRESENT' : 'TRUE_WAIT';

  /* A selected source row can still name what its own runtime has not yet
     observed. That is not a red — the source is green — but it is the reason
     the runtime is still waiting, so it is carried rather than swallowed. */
  const runtime_open = selected.map((r) => r.first_red).filter(Boolean)[0] || null;

  /* A false green is a PASS this run produced that its evidence did not earn.
     With fail-closed promotion in place the count is zero by construction —
     which is the point of constructing it that way rather than counting after. */
  const false_green_count = selected.filter(
    (r) => r.state === 'PASS' && r.evidence_class !== 'NATIVE_RUNTIME_READBACK'
  ).length;

  return {
    selected,
    held,
    rejected,
    occurrences,
    native_runtime,
    false_green_count,
    unsupported_promotion_count: reds.filter((r) => r.includes('UNSUPPORTED_RUNTIME_PROMOTION')).length,
    /* The strongest class actually present, and what it was allowed to earn. */
    strongest_evidence: selected.length
      ? selected.reduce((best, r) => (r.rank > best.rank ? r : best), selected[0]).evidence_class
      : null,
    runtime_open,
    first_red: reds[0] || null,
    reds,
    /* Owner-intervention cost: every held claim is a question a human still has
       to answer, so it is reported rather than hidden inside a summary. */
    owner_interventions: held.length + rejected.length,
    state: reds.length ? 'FAIL' : native_runtime === 'READBACK_PRESENT' ? 'PASS' : 'TRUE_WAIT',
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   THE FRACTAL.

   The rule is one rule. It does not become a different rule because the thing
   it is applied to got bigger, and that is the whole claim:

     nothing is promoted to a rung without a readback FROM that rung.

   Read at every scale the estate is actually read at, it is the same sentence
   each time — only the nouns change:

     a CLAIM is not a fact          without evidence bound to the claim
     a RETURN is not a result       without a receipt from the far side
     a RUN is not a pass            without a readback after the effect
     a PRODUCT is not served        without a surface that answers it
     a LAUNCH is not done           without the window being observed open
     an APPROVAL is not a proof     without the thing approved being read back

   That last rung is the one the operator named, and it decomposes the way the
   others do. APPROVE is a compound: it carries PROVE inside it, and the prefix
   only says who is asking. So an approval given to a crew is a compound proof —
   N principals each owed the same readback, not one assertion multiplied by N.
   A compound of a proof is not a bigger proof. It is N proofs, or it is nothing.

   Which is why this ladder is declared here rather than described: every rung
   is the same refusal, and a system that holds it at one rung and not the
   others has not held it at all.
   ───────────────────────────────────────────────────────────────────────────── */
export const FRACTAL_RUNGS = Object.freeze([
  { rung: 'CLAIM', unit: 'a claim', refused_without: 'evidence bound to the claim' },
  { rung: 'RETURN', unit: 'a return', refused_without: 'a receipt from the far side' },
  { rung: 'RUN', unit: 'a run', refused_without: 'a readback after the effect' },
  { rung: 'PRODUCT', unit: 'a product', refused_without: 'a surface that answers it' },
  { rung: 'LAUNCH', unit: 'a launch', refused_without: 'the window observed open' },
  { rung: 'APPROVAL', unit: 'an approval', refused_without: 'the approved thing read back' },
]);

/** The A/B scoring the procedure declares. B is a hostile control and is never
 *  the preferred workflow — it exists so that a run which promotes without
 *  readback is visible as the failure it is. */
export function abVerdict(result) {
  return {
    A: {
      mode: 'EVIDENCE_FIRST',
      state: result.false_green_count === 0 ? 'PASS' : 'FAIL',
      false_green_count: result.false_green_count,
    },
    B: {
      mode: 'NARRATIVE_FIRST',
      /* B fails the moment anything is promoted without native readback. */
      state: result.unsupported_promotion_count === 0 ? 'NOT_PROMOTED' : 'FAIL',
      unsupported_promotion_count: result.unsupported_promotion_count,
    },
    native_runtime: result.native_runtime,
  };
}