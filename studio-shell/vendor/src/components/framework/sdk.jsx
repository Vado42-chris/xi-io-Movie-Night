import React from 'react';
import { cn } from '@/components/ui/utils';

/* ─────────────────────────────────────────────────────────────
   TIER 1 · SDK
   The only place in the app that names a colour.
   Everything above this line asks for a state; it never picks a colour.
   ───────────────────────────────────────────────────────────── */

export { SystemFileBar, SystemFileFrame, useSystemFileActions } from './SystemFileBar';

export const STATUS = {
  ok: {
    text: 'text-[hsl(var(--color-execution))]',
    dot: 'bg-[hsl(var(--color-execution))]',
    chip: 'border-[hsl(var(--color-execution))]/30 bg-[hsl(var(--color-execution))]/10',
  },
  warn: {
    text: 'text-[hsl(var(--color-warning))]',
    dot: 'bg-[hsl(var(--color-warning))]',
    chip: 'border-[hsl(var(--color-warning))]/30 bg-[hsl(var(--color-warning))]/10',
  },
  error: {
    text: 'text-[hsl(var(--color-error))]',
    dot: 'bg-[hsl(var(--color-error))]',
    chip: 'border-[hsl(var(--color-error))]/30 bg-[hsl(var(--color-error))]/10',
  },
  active: {
    text: 'text-[hsl(var(--color-active))]',
    dot: 'bg-[hsl(var(--color-active))]',
    chip: 'border-[hsl(var(--color-active))]/30 bg-[hsl(var(--color-active))]/10',
  },
  fail: {
    text: 'text-[hsl(var(--color-error))]',
    dot: 'bg-[hsl(var(--color-error))]',
    chip: 'border-[hsl(var(--color-error))]/30 bg-[hsl(var(--color-error))]/10',
  },
  idle: {
    text: 'text-neutral-500',
    dot: 'bg-neutral-600',
    chip: 'border-white/10 bg-white/[0.02]',
  },
  /* ── The third answer ──────────────────────────────────────────
     This map carried ok, warn, error, active, fail and idle. `fail`
     and `error` were the same values written twice, and `idle` was
     the one an unread fell through to — a neutral grey that reads as
     "fine".

     So a surface that had read nothing and a surface that had read
     nothing wrong drew the same picture. That is how a refused read,
     a validator that never ran and a genuinely empty table all came
     out looking like a clean bill of health: the SDK could express
     success and it could express failure, and it had no way at all to
     express ignorance.

     A reading has three answers, not two. The third is not a colour
     between green and red — it is the absence of a reading, so it is
     drawn as an absence: unfilled, dashed, and dimmer than anything
     that was actually observed. */
  unobserved: {
    text: 'text-[hsl(var(--color-settled))]',
    dot: 'bg-transparent border border-dashed border-[hsl(var(--color-settled))]',
    chip: 'border-dashed border-[hsl(var(--color-settled))]/40 bg-transparent',
  },
};

/* The brand accent — the one colour the shell carries across from the solar
   side. Declared here with every other colour, so @ibal is lit by the brand
   rather than by whatever the runtime theme happens to be passing as intent. */
export const BRAND = {
  bg: 'bg-[hsl(var(--color-brand))]',
  bgHover: 'hover:bg-[hsl(var(--color-brand))]/90',
  text: 'text-[hsl(var(--color-brand))]',
  chip: 'border-[hsl(var(--color-brand))]/30 bg-[hsl(var(--color-brand))]/10',
};

/* The projection.
 *
 * One cube. How far it is raised is the only thing that varies — a resting
 * bevel, and two lifts above it. The heights were measured off the owner's
 * Stitch source (129 screens, 23 different box-shadows) and reduced to the
 * ones that recur; the values themselves live in index.css. This names them,
 * so a surface can never invent a fifth depth of its own. */
export const PROJECTION = {
  /* A flush surface must stay FLUSH. The sheet wears the cube at rest now, so
     `none` has to actively remove it rather than simply name nothing — an empty
     string was the same as saying "use whatever the surface has", which was
     nothing then and is a lift now. */
  none: 'shadow-none',
  /* The resting cube carries the LIFT as well as the bevel.
   *
   * A bevel alone is a one-pixel highlight along the top edge: it says "this
   * surface is above the one behind it" only if you are already looking for it.
   * So a card sat on the field wearing nothing but a hairline, and the field
   * read as one flat sheet with lines drawn on it — which is exactly the
   * "border only, no shadow" that the adopter cards were reported as.
   *
   * The lift is the crisp, low drop shadow a card needs to have a boundary of
   * its own. The bevel stays so the lit edge survives. */
  resting: '[box-shadow:var(--projection-bevel),var(--projection-lift)]',
  lifted: '[box-shadow:var(--projection-bevel),var(--projection-lift)]',
  floating: '[box-shadow:var(--projection-float)]',
};

/* ── The rung ────────────────────────────────────────────────────────────
   A surface no longer picks its fill. It declares which rung of the luminance
   ladder it sits on, and its EDGE is derived as one rung above that fill.

   The defect this closes is nesting. One fill for every depth meant a card
   inside a panel was the same value as the panel, so two surfaces at
   different depths could not be told apart — and a translucent overlay made
   it worse, because the fill then depended on what happened to be behind it.
   A rung is declared, so a surface is the same value wherever it lands, and
   it is never the value of the surface it sits on.

   src/lib/surfaceRamp.mjs computes the rungs. Nothing here names a value. */
/* ── THE FILL IS NO LONGER NAMED HERE ──────────────────────────────────────
 *
 * It was `bg-surface-panel` and three siblings: the rung's own value, painted
 * solid, because every rung of the ladder is declared with no alpha at all. So
 * every card this tier drew was a lid — and the depth tokens, the projection cube
 * and the whole glass axis existed while nothing on this layer asked for them.
 * That is the flatness that was reported, and it was one class away the whole
 * time.
 *
 * The fill is the construction-paper sheet now (.xi-paper-glass, index.css). The
 * rung still names the TINT, so a card is the same value wherever it lands and
 * two nested sheets differ by the same step to the eye — while the weight of the
 * sheet, its blur, its saturation and its edge are the person's own glass
 * variables. The controls in the theme panel therefore reach the surfaces they
 * describe, instead of only the chrome around them. */
const SURFACE_RUNG = {
  frame: 'border-surface-content',
  content: 'border-surface-panel',
  panel: 'border-surface-raised',
  raised: 'border-surface-overlay',
};

/* `state` defaults to RESTING, not to none.
 *
 * A surface that has to opt in to being a surface is a surface that is flat by
 * default, and that was the estate's whole problem: the depth axis existed, the
 * atoms carried it, and almost nothing asked for it — so a card and the field
 * behind it were one value. The cube is now worn at rest by everything the SDK
 * draws, and `state="none"` is the deliberate exception for a surface that must
 * sit flush. One default flipped, rather than two hundred call sites edited. */
export function Surface({ className, state = 'resting', level = 'panel', children }) {
  const rung = SURFACE_RUNG[level] ? level : 'panel';
  return (
    <div
      data-rung={rung}
      className={cn(
        'xi-paper-glass rounded-lg border',
        SURFACE_RUNG[rung],
        PROJECTION[state] ?? '',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Label({ className, children }) {
  return (
    <div className={cn('text-[10px] font-mono uppercase tracking-wider text-neutral-400', className)}>
      {children}
    </div>
  );
}

export function Title({ className, children }) {
  return <div className={cn('text-sm text-foreground', className)}>{children}</div>;
}

export function Note({ className, children }) {
  return <div className={cn('text-[11px] leading-relaxed text-neutral-400', className)}>{children}</div>;
}

/* What is owed when there is no reading.
 *
 * Every other primitive here draws something that was observed: a state, a
 * count, a set of rows. None of them can draw the case where nothing was
 * observed at all, and the surfaces therefore drew nothing — which is
 * indistinguishable from drawing "nothing wrong".
 *
 * So this one says what did not answer and why. It takes a `reason` rather
 * than defaulting one, because an absence with no reason attached is the
 * same silence one layer further out. */
export function Unobserved({ what = 'this reading', reason, className }) {
  return (
    <Surface className={cn('border-dashed px-3 py-2', className)}>
      <div className="flex items-center gap-2">
        <Dot state="unobserved" />
        <Label className="text-[hsl(var(--color-settled))]">unobserved</Label>
      </div>
      <Note className="mt-1">
        {what} was not read{reason ? ` — ${reason}` : ''}. An unread is not a pass.
      </Note>
    </Surface>
  );
}

export function Dot({ state = 'idle', pulse = false }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full', STATUS[state].dot, pulse && 'animate-pulse')} />;
}

export function Chip({ state = 'idle', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium',
        STATUS[state].chip,
        STATUS[state].text,
        className
      )}
    >
      {children}
    </span>
  );
}

/* A measured reading — a name and the value that was read for it.
 *
 * The loop is made of these: a turn count, a cadence, the last time it turned.
 * Every surface that showed them drew its own two-line markup for it, which is
 * how one reading ended up wearing three different shapes in three places. This
 * is the atom, so a reading is drawn once and reads the same wherever it lands.
 *
 * `state` is optional and absent means no dot is drawn — a reading that carries
 * no verdict must not be given one. */
export function Readout({ name, value, state, className }) {
  return (
    <Surface className={cn('px-3 py-2', className)}>
      <div className="flex items-center gap-2">
        {state ? <Dot state={state} /> : null}
        <Label>{name}</Label>
      </div>
      <Title className="mt-0.5 font-mono">{value}</Title>
    </Surface>
  );
}

/* A declared value that is typed rather than chosen.
 *
 * Selectable covers the case where the answer is one of a known set. It cannot
 * cover the case where the answer is a name — an address, an owner, a party —
 * and every surface that needed one until now reached past this tier for a raw
 * <input> and named its own colours to do it. That is the defect this tier
 * exists to refuse, so the atom lives here instead, and it is the only place a
 * text field's colour is named. */
export function TextField({ value = '', onChange, placeholder, className, ...rest }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      className={cn(
        'w-full rounded-md border border-surface-panel bg-surface-content px-2.5 py-1',
        'font-mono text-[11px] text-neutral-100 placeholder:text-neutral-600',
        'outline-none transition-colors focus:border-surface-overlay',
        className
      )}
      {...rest}
    />
  );
}

export function Selectable({ active = false, className, children, ...rest }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md border px-2.5 py-1 text-[10px] font-mono transition-colors',
        active
          ? 'border-surface-overlay bg-surface-raised text-neutral-100'
          : 'border-surface-panel text-neutral-500 hover:border-surface-raised hover:text-neutral-300',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* Projection primitive.
 *
 * The SDK does not own the semantic object. It receives one from its owner and
 * projects it using Tier-1 atoms. Owner and kind stay visible so a surface
 * cannot silently promote an Article lesson or Template skill into an SDK item.
 */
export function SemanticProjection({
  kind,
  owner,
  title,
  summary,
  source,
  state = 'unobserved',
  className,
}) {
  return (
    <Surface state="resting" className={cn('p-3 space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{owner} · {kind}</Label>
        <Chip state={state}>{state}</Chip>
      </div>
      <Title>{title}</Title>
      {summary ? <Note>{summary}</Note> : null}
      {source ? <Note className="font-mono opacity-70">{source}</Note> : null}
    </Surface>
  );
}

/* ── THE METER ───────────────────────────────────────────────────────────────
 *
 * Agentic work in comms returns out of order. A crew answers when it answers,
 * so the returns arrive interleaved, syncopated, and in a mess — which is what
 * a crew IS, and not a fault in one. The meter is the atom that reports what
 * that work cost, and it is built so THE ORDER CANNOT MOVE THE NUMBER: it draws
 * a reading from src/lib/meteredWork.mjs, which places every return by its own
 * call_ref rather than by the position it arrived in.
 *
 * Two things it must never do, and does not.
 *
 *   An OWED call is drawn as a debt with the ref NAMED. It is never drawn as a
 *   zero, because a zero and a call nobody has heard from yet look identical on
 *   a screen and are opposites in a bill.
 *
 *   A REFUSED reading is drawn as a refusal. A return that arrived with no
 *   identity could not be placed, and a meter that quietly dropped it would
 *   report a clean shift over work that was actually ordered and paid for.
 *
 * Syncopation is on the face of the meter rather than hidden behind it. Work
 * arriving out of order is normal; a seam getting steadily more syncopated is
 * the thing worth seeing, and it is visible here before it is visible in a bill.
 *
 * ── A READING IS NOT A COIN ────────────────────────────────────────────────
 *
 * A reading is what the SEAM measured. A mint is what the estate's ledger agreed
 * to charge, and the two are different facts that look identical in a total — so
 * the meter carries both, and the mint is drawn beside the reading rather than
 * instead of it.
 *
 * The mint refuses when the identity it would charge is incomplete, and it NAMES
 * what it is owed. That refusal is drawn as a refusal. An AccessMeterEvent
 * carries who is being charged and under what authority, so a coin minted
 * against an invented client is a bill sent to somebody who never ordered the
 * work — and it looks exactly like a correct one.
 *
 * A meter that is never handed a mint draws only its reading. That is the honest
 * reading of a seam nobody has settled yet, and it is never rounded to MINTED.
 */
export function Meter({ reading, mint, label = 'metered work', className }) {
  if (!reading) {
    return <Unobserved what="the meter" reason="no reading was taken" className={className} />;
  }

  const tone = { WHOLE: 'ok', PARTIAL: 'warn', OWED: 'warn', REFUSED: 'error' }[reading.state] ?? 'unobserved';
  const amount = (reading.amount_microunits / 1_000_000).toFixed(4);

  return (
    <Surface level="content" state="resting" className={cn('space-y-2 p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Dot state={tone} />
          <Label>{label}</Label>
        </div>
        <Chip state={tone}>{reading.state}</Chip>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px]">
        <span className="text-neutral-300">{amount} {reading.currency}</span>
        <span className="text-neutral-500">{reading.accounted}/{reading.dispatched} accounted</span>
        {reading.owed ? <span className="text-neutral-400">{reading.owed} owed</span> : null}
        {reading.duplicates ? <span className="text-neutral-400">{reading.duplicates} repeated</span> : null}
        {reading.foreign ? <span className="text-neutral-400">{reading.foreign} foreign</span> : null}
        {reading.order?.out_of_order ? (
          <span className="text-neutral-500">syncopated · {reading.order.displaced} displaced</span>
        ) : null}
      </div>

      {reading.first_owed ? <Note className="font-mono opacity-80">{reading.first_owed}</Note> : null}

      {/* Whether the ledger accepted it — a separate fact from what the seam
          measured, on its own line, because the two are only ever confused when
          they are drawn as one. */}
      {mint ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
          <Dot state={mint.state === 'MINTED' ? 'ok' : 'warn'} />
          <Label>mint</Label>
          <Chip state={mint.state === 'MINTED' ? 'ok' : 'warn'}>{mint.state ?? 'unread'}</Chip>
          <Note className="font-mono opacity-80">
            {mint.state === 'MINTED'
              ? `${mint.counted ?? 0} admitted · ${mint.owed ?? 0} held as owed`
              : mint.owed_fields?.length
                ? `owed ${mint.owed_fields.join(', ')}`
                : (mint.first_red ?? 'the ledger did not answer')}
          </Note>
        </div>
      ) : null}
    </Surface>
  );
}

/* ── TIER 1 · ONE COIN OF THE LOOP ───────────────────────────────────────────
 *
 * A turn and a reap are two coins, not one coin with two lines. They are drawn
 * apart because a total that adds them cannot say whether the estate got cheaper
 * or just turned less — and that question is the whole reason the loop is
 * metered at all.
 *
 * `read` is the third state and it is not a shade of zero. A coin nobody has
 * measured says so; it never draws as 0, because a loop that cost nothing and a
 * loop nobody looked at are the same number and different facts.
 */
export function RollCoin({ metric, count = 0, owed = 0, amount_microunits = 0, read = false, note, className }) {
  if (!read) {
    return <Unobserved what={metric} reason="the loop has not reported a reading" className={className} />;
  }

  const tone = owed > 0 ? 'warn' : 'ok';
  const amount = (amount_microunits / 1_000_000).toFixed(4);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Dot state={tone} />
      <Label>{metric}</Label>
      <Chip state={tone}>{count}</Chip>
      <Note className="font-mono opacity-80">{amount}</Note>
      {owed > 0 ? <Note className="font-mono opacity-80">{owed} owed</Note> : null}
      {note ? <Note className="opacity-60">{note}</Note> : null}
    </div>
  );
}