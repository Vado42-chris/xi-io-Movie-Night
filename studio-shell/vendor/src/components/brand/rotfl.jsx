/* ─────────────────────────────────────────────────────────────
   ROTFL — the kernel's acronym.
   Declared once, here. The whole shell reads the brand from this
   file, so the mark can never drift between screens.

   The letters are the owner's, not this file's. Four are declared
   and the fifth is owed — see `letters` below.

   The expansion reads "Render On The Fly", and it lands — on
   purpose — on the acronym for laughing, which is what ANTS did to
   the owner the moment he coined them. The joke is load-bearing:
   it is the reason the name survived, and the reason "tokens" is
   still what the agents are called.

   What ROTFL DOES is already written down where it happens, in
   src/components/framework/PneumaPlane.jsx: "rotate the room, not
   the furniture." One plane, many angles, never a second copy of
   the invariant. That is the behaviour. The letters below are the
   name.
   ───────────────────────────────────────────────────────────── */

export const ROTFL = {
  mark: 'ROTFL',
  spaced: 'R O T F L',
  // The five letters of the kernel, as the owner supplied them. A meaning
  // declared here appears everywhere the shell carries the brand — nothing
  // else to edit.
  //
  // Four are declared. The fifth is not, and it stays empty rather than being
  // filled: an invented letter is this file writing the owner's brand for him,
  // which is the one thing a brand file must never do. `SemanticCrossingLane`
  // reads however many are supplied, so four of five is a real state here and
  // not a broken one.
  letters: [
    { letter: 'R', meaning: 'Render' },
    { letter: 'O', meaning: 'On' },
    { letter: 'T', meaning: 'The' },
    { letter: 'F', meaning: 'Fly' },
    // Owed — and owed to a named source, which is not the same as missing.
    //
    // The owner has said "Render On The Fly" and has not named the fifth
    // letter, because it is not a word awaiting dictation. It is a RUNTIME
    // OBSERVABLE. It is revealed by the loop turning and the coin spinning:
    // the xi-io mark carries ONE diagonal — variant A forward, variant B
    // return, "two pipelines, opposing, never one without the other" — and at
    // rest only one of them is drawn. The handshake between the two is what
    // shows both, and that runtime is not served by the API yet.
    //
    // So the literal still resolves to UNKNOWN in framework/semanticCrossing.js
    // and that crossing entry stays WITHHELD. This is not a gap in the file —
    // it is the file naming WHERE the answer will come from, so the next
    // reader runs the loop instead of inventing a word for it.
    { letter: 'L', meaning: '' },
  ],
};

/* ── ANTS ────────────────────────────────────────────────────────────
   The agents, under the name they were given first.

   The acronym came first; the handshake came later. While the first
   version of this framework was being written — before an ack existed to
   be sent — it was the owner's own shorthand for the agents being named,
   and the joke was the whole point:

       Automated Neural TOLKEINS

   It made the owner laugh, and it stuck. "Tokens" is what they are still
   called, and this is why: not a unit of a model's input, but a namesake
   of a name chosen on purpose. The name is older than the machinery it
   now describes.

   Recorded here because a name that survives only in conversation is a
   name the next person re-invents, differently, and calls it the
   original. The shell reads the brand from this file; this is the brand.
   ──────────────────────────────────────────────────────────────────── */
export const ANTS = {
  acronym: 'ANTS',
  expansion: 'Automated Neural TOLKEINS',
  reads_as: 'Automated Neural Tokens',
  origin:
    'Coined by the owner while writing the first version of this framework, before the ack handshake existed, as shorthand for the AI agents being named.',
};

/* ── THE BRAND STANDARD ──────────────────────────────────────────────
   What every xi-io product is held to, stated by the owner:

       Do good for the people who need it most.

   Everything else in this shell is that standard applied to a screen.
   The rule that an unread is never drawn as a pass, the refusal to show
   a lane as healthy because nothing looked at it, the ladder that names
   what it is owed rather than rounding it away — none of those are
   decoration. A surface that looks well while something is broken is a
   surface that failed the person reading it, and that person is the one
   this is for.
   ──────────────────────────────────────────────────────────────────── */
export const BRAND_STANDARD = {
  standard: 'Do good for the people who need it most.',
  applies_to: 'every xi-io product',
};

export default ROTFL;