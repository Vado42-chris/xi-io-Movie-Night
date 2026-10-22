import React from 'react';
import { cn } from '@/lib/utils';

// ── The chrome language ──────────────────────────────────────────────────────
//
// Every piece of shell furniture — the top bar, the taskbar, the tool rail, the
// window title bar — takes its controls from here and invents nothing.
//
// It used to have three: a pill with a border, a solid rectangle, and a bare
// icon. Three ways to say "button", on one screen, is not a style — it is an
// accident of who happened to write which surface. There is one button now, and
// it has three states: resting, hover, active.
//
// The rules, written down so they cannot drift apart again:
//
//   · SQUARE. Every edge, everywhere in the chrome. There is no radius here and
//     no token to change one. If you are reaching for rounded-full, you are
//     describing a dot, not a control.
//   · A SHAPE, NOT A LINE. A control is a filled block, and its state is carried
//     by how much light is in that fill — never by a stroke drawn around nothing.
//
//     This is the rule that was written down wrong, and every bordered control in
//     the shell descends from that one sentence. "Depth is a border" is a
//     document editor's rule: a 1px page divider, where the paper behind it is
//     white and a hairline is all the separation a table needs. On a near-black
//     bar a hairline at 10% white is barely there at all, so a bordered button
//     reads as a word with a faint box near it — and the box is the part that
//     gets lost. The fill is what the eye actually catches, so the fill is what
//     carries the meaning. A shape can tell you it is lit; a line can only
//     outline where it would have been.
//   · ICONS ARE BARE. A glyph sits on the bar itself. No container, no plate, no
//     square of fill behind it. An icon wearing a background is a button wearing
//     two shapes, and only one of them is doing any work.
//   · ONE ICON SIZE PER TIER. 16px in the bars, 20px in the taskbar. An icon
//     that changes size between two bars on the same screen reads as two
//     different icon sets, because that is exactly what it is. And every icon
//     is lucide — a hand-drawn <svg> beside a lucide glyph is a second set.

export const CHROME_ICON = {
    bar: 'w-4 h-4',
    taskbar: 'w-5 h-5',
};

const base =
    'inline-flex items-center justify-center gap-2 rounded-none border shrink-0 select-none ' +
    'transition-colors duration-200 focus-visible:outline-none ' +
    'focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-intent))] ' +
    'disabled:opacity-40 disabled:pointer-events-none';

/* Every tone is border-transparent, and the `border` in `base` stays only so the
   box model does not shift between states. The colour is never carried by a
   stroke — only by the fill. */
/* Every tone is written in TOKENS, and that is not a style preference.
 *
 * These were hardcoded white — `bg-white/[0.08]`, `text-neutral-300` — which
 * reads correctly on a dark bar and vanishes completely on a light one. So the
 * shell had exactly one mode: any attempt to light it left every control in the
 * chrome either invisible or still dark, and the honest reading of that is that
 * the light token set was declared and then never consumed.
 *
 * `foreground/[0.08]` is the same amount of light in both: a pale wash on the
 * dark shell, a dark wash on the light one. The amount is the design; the
 * direction is the mode. */
const tones = {
    // Present but not asking for attention — a bar with many controls. A bare
    // glyph or a bare word; the fill appears only under the pointer.
    quiet: 'border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07]',
    // A control that is offered and not chosen. A fill you can see at rest, so
    // it reads as a shape rather than as a label waiting for a line.
    rest: 'border-transparent bg-foreground/[0.08] text-foreground/80 hover:bg-foreground/[0.14] hover:text-foreground',
    // The one lit thing. Reserved for the control the user actually chose — and
    // it is a solid block of the accent, not an outline drawn around it. The
    // shape is the message; the colour is the state.
    active: 'border-transparent bg-[hsl(var(--color-intent))] text-background font-medium hover:bg-[hsl(var(--color-intent))]/90',
    // The single commitment on a bar. One per surface, at most.
    solid: 'border-transparent bg-foreground text-background font-bold hover:bg-foreground/90',
};

const sizes = {
    sm: 'h-6 px-2 text-[10px]',
    md: 'h-7 px-2.5 text-[10px]',
    lg: 'h-8 px-3 text-[11px]',
    icon: 'h-7 w-7 p-0',
};

const pick = (tone, active) => (active ? tones.active : tones[tone] || tones.rest);

// Exported so a <Link> can wear the same button without being a <button>.
// Navigation that looks like one thing and buttons that look like another is
// how a bar ends up speaking two languages again.
export const chromeClass = ({ tone = 'rest', size = 'md', active = false, className } = {}) =>
    cn(base, sizes[size], pick(tone, active), className);

export const ChromeButton = ({ tone = 'rest', size = 'md', active = false, className, ...props }) => (
    <button type="button" className={chromeClass({ tone, size, active, className })} {...props} />
);

// A label that states a condition rather than offering an action. Uppercase and
// tracked, and never wearing the accent — a status that looks like a button is
// a status people will try to press.
export const ChromeChip = ({ active = false, className, ...props }) => (
    <ChromeButton size="md" active={active} className={cn('uppercase tracking-wider font-medium', className)} {...props} />
);

export const ChromeIconButton = ({ icon: Icon, label, tone = 'quiet', size = 'icon', active = false, className, ...props }) => (
    <ChromeButton size={size} tone={tone} active={active} title={label} aria-label={label} className={className} {...props}>
        <Icon className={CHROME_ICON.bar} />
    </ChromeButton>
);

export const ChromeDivider = ({ className }) => (
    <span aria-hidden="true" className={cn('w-px h-4 bg-border shrink-0', className)} />
);