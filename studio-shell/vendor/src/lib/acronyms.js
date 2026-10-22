/* Acronyms and their flatplanes — declared once, parsed everywhere.
 *
 * The shell speaks in acronyms. Each one is declared here with its expansion and
 * the side that owns it. Nothing else in the app restates them, so the meaning
 * travels with the letters instead of being copied into every screen that
 * happens to mention them.
 *
 * Flatplanes: acronyms are grouped by length. Odd lengths sit on one plane, even
 * lengths on another, so a three-letter mark can never be read as a four-letter
 * one. The plane a mark lands on is derived from its length — never declared per
 * entry. To fractalise, add another acronym; it lands where it belongs on its own.
 */

export const ACRONYMS = [
  {
    acronym: 'ACK',
    expansion: 'Agent Control Kernel',
    home: 'kernel',
    owns: 'Capability, effect ceilings, and the handshake that proves an attempt landed.',
  },
  {
    acronym: 'ACS',
    expansion: 'Agent Control Systems',
    home: 'kernel',
    owns: 'Registry admission — which rung a subject stands on, and on whose evidence.',
  },
  {
    acronym: 'HOM',
    expansion: 'HOME',
    home: 'trinity',
    owns: 'The life balance — what the work costs you and what it gives back.',
  },
  {
    acronym: 'WRK',
    expansion: 'WORK',
    home: 'trinity',
    owns: 'The money and the business — what this is worth and who pays for it.',
  },
  {
    acronym: 'LIF',
    expansion: 'LIFE',
    home: 'trinity',
    owns: 'What can be automated so it stops needing you at all.',
  },
  {
    acronym: 'TLA',
    expansion: 'Three-Letter Acronym',
    home: 'odd plane',
    owns: 'Names the odd plane. The vocabulary itself, declared once and parsed out of any text.',
  },
  {
    acronym: 'TOOL',
    expansion: 'Four-Letter Flatplane',
    home: 'even plane',
    owns: 'Names the even plane. Four-letter marks land here.',
  },
];

/* The one rule. Everything else follows from the length of the letters. */
export const planeOf = (acronym) => (acronym.length % 2 === 0 ? 'even' : 'odd');

/* Each plane is named by the mark that declares it — TLA is three letters so it
   names the odd plane, TOOL is four so it names the even one. */
export const FLATPLANES = ['odd', 'even'].map((plane) => {
  const members = ACRONYMS.filter((entry) => planeOf(entry.acronym) === plane);
  const declared = members.find((entry) => entry.home === `${plane} plane`);
  return { plane, name: declared ? declared.acronym : null, members };
});

const BY_ACRONYM = Object.fromEntries(ACRONYMS.map((entry) => [entry.acronym, entry]));

export const findAcronym = (acronym) => BY_ACRONYM[acronym] || null;

/* Longest first, so a longer mark is never eaten by a shorter one, and
   word-bounded, so ACK inside ACKNOWLEDGE is not a match. */
function buildPattern() {
  const alternatives = [...ACRONYMS]
    .sort((a, b) => b.acronym.length - a.acronym.length)
    .map((entry) => entry.acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(`\\b(${alternatives})\\b`, 'g');
}

/* Splits a string into plain runs and declared acronyms. It runs on whatever
   string it is handed, so text still arriving parses exactly like text at rest. */
export function parseAcronyms(text) {
  if (!text) return [];
  const source = String(text);
  if (ACRONYMS.length === 0) return [{ type: 'text', value: source }];

  const pattern = buildPattern();
  const segments = [];
  let cursor = 0;

  let match = pattern.exec(source);
  while (match) {
    if (match.index > cursor) {
      segments.push({ type: 'text', value: source.slice(cursor, match.index) });
    }
    segments.push({
      type: 'acronym',
      value: match[1],
      plane: planeOf(match[1]),
      ...BY_ACRONYM[match[1]],
    });
    cursor = match.index + match[1].length;
    match = pattern.exec(source);
  }

  if (cursor < source.length) {
    segments.push({ type: 'text', value: source.slice(cursor) });
  }

  return segments;
}

export default ACRONYMS;