/* ─────────────────────────────────────────────────────────────────────────────
   THE COMPOUND APPROVAL — APPROVE, done as arithmetic.

   The operator's claim, taken literally and then made executable:

     APPROVE is a COMPOUND PROVE. For your TEAMS.

   Split the word and it is already an equation. APPROVE = AP ∘ PROVE. The
   prefix says WHO is asking; the body says WHAT has to be shown. AP is not a
   weaker PROVE, it is a different operand — and an operand that carries no
   proof of its own is the identity, which is why one principal asking alone
   reduces to plain PROVE. That reduction is the test of the decomposition: if
   AP did not vanish at N = 1, the split would be decoration.

   ── THE MATH, STATED ONCE ───────────────────────────────────────────────────

   Two operators, and they are not the same operator:

     TEAMS ADD.      |crew| = Σ 1 over principals. Five teams is five, never one
                     team said five times. Adding a principal adds a debt, not
                     a vote.

     PROOFS MULTIPLY.  Π over the proofs. 1 × 1 × 1 = 1, and 1 × 1 × 0 = 0.
                     One unread return zeroes the whole product — it does not
                     shade it, weight it, or average it away.

   So a compound approval is Π over Σ: a product of proofs across a sum of
   principals.

     APPROVE(crew) = Π_{p ∈ crew} PROVE(p)

   And the consequence is the part that matters, because it is the part people
   get wrong by instinct:

     ADDING PRINCIPALS CAN NEVER RESCUE A ZERO.
     Only a READBACK can move a zero to a one.

   Five teams agreeing that a thing works is 1 × 1 × 1 × 1 × 1 = 1 if each of
   them read it back, and 0 if any one of them did not — regardless of how
   senior the one is, or how many agreed. Consensus is not a factor in this
   product. There is no term for it. That is not a policy this file adopts; it
   is what multiplication does, and the reason the rule is written as
   arithmetic is so that it cannot be argued with.

   ── WHY IT IS CALLED COMPOUND, AND NOT BIG ──────────────────────────────────

   A compound is a product of factors, so it INHERITS every factor's failure.
   That is the whole difference between a compound proof and a large one:

     a large proof   is one principal's readback, repeated
     a compound proof is N principals' readbacks, conjoined

   A compound of a proof is not a bigger proof. It is N proofs, or it is
   nothing — and the second outcome is the common one, which is why the
   honest default here is NOT_ADMITTED.

   ── THE TLA, READ AS AN ACRONYM ─────────────────────────────────────────────

   The operator says this is a compound TLA when you math it out, and it is:
   the word carries two operators, and the composition is the definition. Read
   as letters it is AP ∘ PROVE. Read as a sum of its parts it is Π over Σ. The
   two readings are the same equation, which is the only reason a three-letter
   acronym is worth having at all.

   ── FRACTAL ─────────────────────────────────────────────────────────────────

   One rule, at every scale the estate reads at — the rungs are declared once,
   in pneumaFanIn.mjs, and imported rather than restated. At each rung the
   arithmetic is the same Π over the denominators that rung owns:

     a claim    is a Π over its evidence
     a return   is a Π over its receipt and its readback
     a run      is a Π over its effects
     a product  is a Π over its surfaces
     a launch   is a Π over its windows observed open
     an approval is a Π over its principals' proofs

   A system that holds the product rule at one rung and averages at another has
   not held it — it has held a preference. So the rungs are read from the one
   declaration and the same function is applied to each.
   ───────────────────────────────────────────────────────────────────────────── */
import { FRACTAL_RUNGS } from './pneumaFanIn.mjs';
/* The plane rule, imported and never restated. acronyms.js already declares how
   a mark lands on a plane — by its length, never per entry — and the registry
   says outright that to fractalise you add another acronym and it lands where it
   belongs on its own. Restating `length % 2` here would be a second rule that
   could drift from the one the rest of the shell parses by, so it is imported. */
import { planeOf } from './acronyms.js';

/** The decomposition, declared. Two operators, composed. */
export const COMPOUND = Object.freeze({
  word: 'APPROVE',
  factors: Object.freeze(['AP', 'PROVE']),
  composition: 'AP ∘ PROVE',
  ap_meaning: 'the principal asking — carries no proof of its own',
  prove_meaning: 'the readback that must land',
  /* The reduction that proves the split is real: at one principal, AP is the
     identity and the word collapses to PROVE. */
  identity_check: 'AP at N = 1 is the identity — APPROVE reduces to PROVE',
});

/**
 * THE COMPOUND TLA, as arithmetic rather than as a reading.
 *
 * `AP ∘ PROVE` is a claim about meaning, and meaning can be argued with. The
 * letters cannot. APPROVE is seven letters; AP is two and PROVE is five, and
 * 2 + 5 = 7 with the concatenation landing exactly on the word:
 *
 *     'AP' + 'PROVE' === 'APPROVE'
 *
 * That is what makes this a COMPOUND TLA and not a metaphor with a slash in it.
 * The composition consumes nothing and invents nothing — if a letter were lost
 * or inserted, the word would no longer be the concatenation of its parts and
 * the acronym would be decoration. So the conservation is computed, not
 * declared, and it is the first thing that has to hold before any of the rest
 * of this file is worth reading.
 */
export const TLA = Object.freeze({
  word: 'APPROVE',
  parts: Object.freeze(['AP', 'PROVE']),
  letters: Object.freeze(['A', 'P', 'P', 'R', 'O', 'V', 'E']),
  letter_math: "|AP| + |PROVE| = 2 + 5 = 7 = |APPROVE|",
  /* Both readings, run against the real string rather than typed as prose. */
  conserved: 'AP'.length + 'PROVE'.length === 'APPROVE'.length,
  concatenates: 'AP' + 'PROVE' === 'APPROVE',

  /* ── IS IT ACTUALLY A TLA? ASK THE ESTATE, NOT OPINION ───────────────────
     The registry settles this by arithmetic: a mark's plane is derived from its
     length, so APPROVE is seven letters and seven is odd, which is the TLA
     plane. Nothing here decides that — planeOf does, and it is imported. */
  plane: planeOf('APPROVE'),
  is_tla: planeOf('APPROVE') === 'odd',
  plane_math: "|APPROVE| = 7 → odd → the TLA plane",
  /* And this is why it is COMPOUND rather than merely long: its two factors sit
     on DIFFERENT planes. AP is two letters (even), PROVE is five (odd), and the
     composition recombines onto odd. A mark that was only longer would stay on
     one plane; this one crosses. */
  factor_planes: Object.freeze({ AP: planeOf('AP'), PROVE: planeOf('PROVE') }),
  crosses_planes: planeOf('AP') !== planeOf('PROVE'),
  plane_crossing: `AP is ${planeOf('AP')} ∘ PROVE is ${planeOf('PROVE')} → ${planeOf('APPROVE')}`,
});

/**
 * THE SECOND COMPOUND TLA — FLATPLANE, done as arithmetic.
 *
 * The operator's second claim, taken literally and then made executable:
 *
 *     the 4 − 2 calculation will always result in a FLATPLANE
 *
 * FLATPLANE is the word that calculation returns, and it is a compound TLA by
 * exactly the test APPROVE was put to — not by resemblance to it:
 *
 *     'FLAT' + 'PLANE' === 'FLATPLANE'
 *     |FLAT| + |PLANE| = 4 + 5 = 9 = |FLATPLANE|
 *
 * Two letters lost or inserted and the word would no longer be the
 * concatenation of its parts. So the conservation is computed against the real
 * string, never typed as prose.
 *
 * ── AND IT CROSSES, WHICH IS WHAT MAKES IT COMPOUND ─────────────────────────
 *
 * FLAT is four letters and lands on the even plane; PLANE is five and lands on
 * the odd one. The composition recombines onto odd — the TLA plane. A mark that
 * was only longer would stay on one plane. This one crosses, and the crossing is
 * the whole difference between a compound TLA and a large one.
 *
 * The plane is not decided here. planeOf decides it, from the length, exactly as
 * it decides it for every other mark in the estate.
 */
export const TLA_FLATPLANE = Object.freeze({
  family: 'UX',
  ordinal: 1,
  word: 'FLATPLANE',
  parts: Object.freeze(['FLAT', 'PLANE']),
  letters: Object.freeze(['F', 'L', 'A', 'T', 'P', 'L', 'A', 'N', 'E']),
  letter_math: '|FLAT| + |PLANE| = 4 + 5 = 9 = |FLATPLANE|',
  conserved: 'FLAT'.length + 'PLANE'.length === 'FLATPLANE'.length,
  concatenates: 'FLAT' + 'PLANE' === 'FLATPLANE',

  plane: planeOf('FLATPLANE'),
  is_tla: planeOf('FLATPLANE') === 'odd',
  plane_math: '|FLATPLANE| = 9 → odd → the TLA plane',
  factor_planes: Object.freeze({ FLAT: planeOf('FLAT'), PLANE: planeOf('PLANE') }),
  crosses_planes: planeOf('FLAT') !== planeOf('PLANE'),
  plane_crossing: `FLAT is ${planeOf('FLAT')} ∘ PLANE is ${planeOf('PLANE')} → ${planeOf('FLATPLANE')}`,

  /* The reduction. APPROVE collapsed to PROVE at one principal; this collapses
     at one product, where the union and the intersection are one set by
     definition — so C ≡ S₃ and the two planes were already one. Which is why a
     single product carries no distinction for the 4 − 2 to find. */
  identity_check: 'at one product the union and the intersection are one set, so C ≡ S₃ and the planes are already one',
});

/** Every compound TLA the estate has declared, read from the one place. */
export const COMPOUND_TLAS = Object.freeze([TLA, TLA_FLATPLANE]);

/** One reading of a compound TLA, so a surface does not restate the checks. */
export function tlaReading(tla) {
  return {
    word: tla.word,
    composition: tla.parts.join(' ∘ '),
    lettersHold: Boolean(tla.concatenates && tla.conserved),
    crossesPlanes: Boolean(tla.crosses_planes),
    isTla: Boolean(tla.is_tla),
    plane: tla.plane,
    planeCrossing: tla.plane_crossing,
    identityCheck: tla.identity_check,
    compound: Boolean(tla.concatenates && tla.conserved && tla.crosses_planes),
  };
}

/** The two operators, and they are deliberately not the same one. */
export const ARITHMETIC = Object.freeze({
  over_principals: 'SUM',
  over_proofs: 'PRODUCT',
  form: 'Π over Σ — a product of proofs across a sum of principals',
  consequence: 'adding principals can never rescue a zero; only a readback can',
  zero: 'one unread return zeroes the whole product',
  note: 'consensus is not a factor in this product, and there is no term for it',
});

export const APPROVAL_STATE = Object.freeze({
  ADMITTED: 'ADMITTED',
  NOT_ADMITTED: 'NOT_ADMITTED',
});

/** One term: a single thing that either was read back or was not.
 *  Absent evidence is not a soft pass — it is the zero factor. */
export function prove({ ref, proved, evidence_ref = null, whole_note_visible = false, visible_readback_ref = null, first_red = null }) {
  const readbackProved = proved === true;
  const visibleProved = whole_note_visible === true && Boolean(visible_readback_ref);
  const isProved = readbackProved && visibleProved;
  return {
    ref,
    factor: isProved ? 1 : 0,
    proved: isProved,
    evidence_ref,
    whole_note_visible: visibleProved,
    visible_readback_ref,
    first_red: isProved
      ? null
      : !readbackProved
        ? first_red || `NO_READBACK — ${ref} was asserted and nothing was read back to support it`
        : `WHOLE_NOTE_NOT_VISIBLE — ${ref} has local proof but no visible parent-user readback`,
  };
}

/**
 * Approve a compound: a crew of principals, each owing its own proofs.
 *
 * @param {string} ref
 * @param {Array<{ref: string, proves: Array}>} principals
 */
export function approve({ ref, principals = [] }) {
  const crew = principals.map((principal) => {
    /* ── A principal may itself be a crew ────────────────────────────────────
       This is the composition that makes the word compound rather than merely
       plural. An approval is a legal factor in another approval, and its factor
       is its own product — so a team of teams can be approved, and the tree's
       shape cannot change the verdict. Without this the operator only ever
       reads leaves, and "for your teams" would mean "for a flat list". */
    if (principal.approves) {
      const nested = principal.approves;
      const factor = nested.product === 1 ? 1 : 0;
      return {
        ref: principal.ref,
        nested: true,
        terms: nested.terms,
        proved: nested.proved,
        factor,
        missing: nested.missing,
        first_red: factor
          ? null
          : `SUB_CREW_NOT_PROVED — ${principal.ref} is itself an approval and its product is ${nested.product}: ${nested.first_red}`,
      };
    }
    const terms = (principal.proves || []).map(prove);
    const missing = terms.filter((t) => !t.proved);
    return {
      ref: principal.ref,
      terms,
      proved: terms.length - missing.length,
      factor: terms.length && missing.length === 0 ? 1 : 0,
      missing: missing.map((m) => m.ref),
      first_red: missing.length
        ? `PRINCIPAL_NOT_PROVED — ${principal.ref} owes ${missing.length} readback${missing.length === 1 ? '' : 's'} and did not return ${missing.length === 1 ? 'it' : 'them'}: ${missing.map((m) => m.ref).join(', ')}`
        : null,
    };
  });

  /* The product. Written as a real reduction rather than a filter, because the
     filter is where the arithmetic gets lost: `every()` reads as a check, and
     a product reads as what it is. */
  const product = crew.reduce((acc, p) => acc * p.factor, crew.length ? 1 : 0);
  const terms = crew.flatMap((c) => c.terms);
  const missing = crew.flatMap((c) => c.missing.map((m) => `${c.ref}:${m}`));
  const state = product === 1 ? APPROVAL_STATE.ADMITTED : APPROVAL_STATE.NOT_ADMITTED;

  /* The same product, read at the scale the DENOMINATORS live on.
     The principal-level equation collapses a one-principal crew to "0 = 0" — a
     verdict with no operand in it, which is the work a reader came to check. This
     is that multiplication shown term by term, in order. Null when the crew is
     nested, because a sub-crew carries no terms of its own to show. */
  const terms_equation = terms.length
    ? `${terms.map((t) => t.factor).join(' × ')} = ${terms.reduce((a, t) => a * t.factor, 1)}`
    : null;

  return {
    ref,
    word: COMPOUND.word,
    composition: COMPOUND.composition,
    principals: crew.length,
    terms: terms.length,
    proved: terms.filter((t) => t.proved).length,
    /* The equation, written out, so a reader can check the arithmetic rather
       than believe the verdict. */
    equation: `${crew.map((c) => c.factor).join(' × ')} = ${product}`,
    terms_equation,
    product,
    missing,
    crew,
    state,
    /* The first red is the first principal that could not prove itself — not
       the count. A count is a statistic; this is a name. */
    first_red:
      state === APPROVAL_STATE.ADMITTED
        ? null
        : crew.find((c) => c.first_red)?.first_red ||
          'NOTHING_TO_APPROVE — the crew was empty, and an empty product is zero rather than one',
  };
}

/**
 * The fractal, as arithmetic. The rungs come from the one declaration in
 * pneumaFanIn.mjs; this only states what each rung's denominators are, so the
 * same Π is applied at every scale instead of a different rule at each.
 */
export const FRACTAL_ARITHMETIC = Object.freeze(
  FRACTAL_RUNGS.map((r) => ({
    rung: r.rung,
    unit: r.unit,
    product_over: r.refused_without,
    rule: `${r.unit} is a Π over ${r.refused_without}`,
    /* The same word at every rung. The compound TLA is what is being applied
       whatever the scale — only the denominators change. */
    word: COMPOUND.composition,
    /* And the same plane, because the plane is derived from the word's length
       rather than declared per rung. That is what makes the rule fractal: a
       claim's approval and a launch's approval land on the same plane without
       anyone deciding that they should. */
    plane: planeOf(COMPOUND.word),
  })),
);

/** Apply the one rule to a rung — the same function, whatever the scale. */
export function atRung(rung, terms) {
  const declared = FRACTAL_ARITHMETIC.find((r) => r.rung === rung);
  if (!declared) {
    return { rung, state: 'UNKNOWN', first_red: `UNDECLARED_RUNG — ${rung} is not one of the declared rungs` };
  }
  const verdict = approve({ ref: declared.unit, principals: [{ ref: declared.unit, proves: terms }] });
  return {
    rung,
    unit: declared.unit,
    product_over: declared.product_over,
    state: verdict.state,
    equation: verdict.equation,
    terms_equation: verdict.terms_equation,
    missing: verdict.missing,
    first_red: verdict.first_red,
  };
}

export default approve;