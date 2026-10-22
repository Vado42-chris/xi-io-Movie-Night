/* ── THE PRIMITIVE CONTRACT · xiio.pane-contract/v1 ──────────────────────────
 *
 * Owner law, 2026-10-01. The whole model, in the owner's own words:
 *
 *     MOBILE    = one column  = one pane
 *     TABLET    = several mobile-width panes = canonical composition surface
 *     DESKTOP   = those same panes snapped into a larger workspace
 *
 *     So responsiveness is not primarily breakpoint CSS. It is pane composition.
 *
 *     A tool drawer is therefore not a special mobile component:
 *
 *         TOOL → DRAWER → FLYOUT PANEL → PANE
 *
 *     And a pane has the same identity everywhere.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 *
 * Because the estate already had FOUR correct declarations of four quarters of
 * this law, and no statement that they were one law:
 *
 *     src/lib/columnScreen.mjs        PARTITION ≠ ARRANGEMENT; a column IS a screen
 *     src/lib/surfaceEscalation.mjs   TOOL → DRAWER → FLYOUT → PANE, by capacity
 *     src/lib/desktopPane.mjs         a pane is anything that may be JOINED
 *     src/lib/squishRule.mjs          too many rows is a missing CATEGORY
 *
 * Four files agreeing by accident is four files that will disagree on the first
 * edit. This is the contract they are all readings of, and it NAMES them rather
 * than restating them — the readings stay where they are, and this says which
 * law each one is a reading of. A second copy of a rule is the copy that drifts.
 *
 * ── THE IMPLEMENTATION TARGET IS THE CONTRACT, NOT THE COMPONENT NAMES ──────
 *
 * This matters and it is deliberate. Names like ContextualToolDrawer, ToolDock,
 * UnifiedCanvas, ChatDockSlot and OsforgePlane exist in THIS repository — but a
 * name reported by an agent is not evidence that the thing behind it implements
 * this law, and it is not evidence of what is in any other tree. So the target
 * is stated as PRIMITIVES, and a surface is judged by which primitive it is,
 * not by what it is called. A component that satisfies PANE is a pane whatever
 * its file is named; one that does not is not, whatever its file is named.
 *
 * ── WHAT IS REFUSED ─────────────────────────────────────────────────────────
 *
 *   · NO THREE RESPONSIVE VERSIONS. Designing a mobile Studio, a tablet Studio
 *     and a desktop Studio is three information architectures that will drift
 *     into three products. There is one partition and one arrangement function.
 *
 *   · NO NEW INFORMATION ARCHITECTURE ON DESKTOP. Desktop does not get more
 *     surfaces; it gets enough X-space to compose more of the SAME panes at
 *     once. A surface that exists only on desktop is a partition change wearing
 *     an arrangement's clothes.
 *
 *   · GLASS IS NOT DECORATION. It is a boundary with one meaning — see below.
 *     "Modern UI" glass over a working artifact is the Looking Glass metaphor
 *     spent as a texture.
 *
 *   · A STRUCTURAL LINE IS NEVER STYLED OVER. It is structural debugging
 *     information (the owner's own reading of the current rig). Styling it makes
 *     the scaffolding permanent; the line is REMOVED, and only once the material
 *     beneath it carries the same meaning.
 *
 * Dependency-free and browser-safe. A contract, not a measurement. Nothing here
 * claims any surface in the estate has been read against it — that census is
 * OWED, and is listed as owed below rather than implied by the declaration. */

export const SCHEMA = 'xiio.pane-contract/v1';

/* ── THE PRIMITIVES ──────────────────────────────────────────────────────────
 *
 * The named implementation target. Each is a SHAPE — a container for the one
 * below it — and the whole estate is meant to be built from these rather than
 * from one bespoke implementation per feature.
 *
 * `consumer` is what the primitive is FOR, and it is the line that matters most:
 * chat, tools, settings, inspector, layers, Bins, Glass Box, citations, comments
 * and AI context are all CONSUMERS of these shapes. None of them gets to invent
 * a responsive implementation of its own. That is the sentence that turns one
 * UX system into one primitive system. */
export const PRIMITIVES = Object.freeze({
    CANVAS: {
        holds: 'panes',
        is: 'the field a composition sits on',
        consumer: 'the editor, the desktop, the article surface',
    },
    PANE: {
        holds: 'blocks, or a single surface',
        is: 'a surface of its own — resizable, pinnable, with scroll regions it owns',
        consumer: 'project, canvas, tools, chat, settings, inspector, layers, Bins, Glass Box, citations, comments, AI context',
        law: 'src/lib/desktopPane.mjs — a pane is anything that occupies a rect and may be joined',
    },
    DRAWER: {
        holds: 'tools',
        is: 'the column where a tool is CHOSEN',
        consumer: 'the tool drawer, the settings rail, the layers list',
        law: 'src/lib/surfaceEscalation.mjs',
    },
    FLYOUT: {
        holds: 'an expanded tool',
        is: 'a panel hanging off the row that opened it, so the row stays on screen',
        consumer: 'a tool whose panel does not fit the column it was chosen in',
        law: 'src/lib/surfaceEscalation.mjs — FLYOUT_ANCHOR',
    },
    DOCK: {
        holds: 'drawers',
        is: 'the edge a drawer is docked to',
        consumer: 'the shell',
    },
    TOOL: {
        holds: 'one control',
        is: 'a row',
        consumer: 'every action in the estate',
    },
    TOOLGROUP: {
        holds: 'tools',
        is: 'the categorisation a squished drawer owes — NOT a shape',
        consumer: 'any drawer holding more rows than it can show',
        law: 'src/lib/squishRule.mjs — rows that do not fit are CATEGORISED, never grown',
    },
    INSPECTOR: {
        holds: 'the settings of the current SELECTION',
        is: 'a pane whose subject is another pane',
        consumer: 'the Z2 drawer, the property editor',
    },
    SELECTION: {
        holds: 'one or more addressable nodes',
        is: 'what the INSPECTOR is reading, and the reason its tools changed',
        consumer: 'the editor, the canvas, the desktop',
    },
    SNAPTARGET: {
        holds: 'a rect a pane may come flush to',
        is: 'an entry in the neighbour set the join maths already takes',
        consumer: 'every pane, including the tool drawer',
        law: 'src/lib/desktopSnap.mjs — snapToNeighbors',
    },
    PROJECTION: {
        holds: 'a pane read at another width or on another device',
        is: 'the SAME pane wearing its other arrangement, never a second pane',
        consumer: 'mobile, tablet, desktop, satellite, export',
        law: 'src/lib/columnScreen.mjs — PARTITION ≠ ARRANGEMENT',
    },
});

export const PRIMITIVE_NAMES = Object.freeze(Object.keys(PRIMITIVES));

/* ── THE THREE ARRANGEMENTS ──────────────────────────────────────────────────
 *
 * The partition is IDENTICAL on every device. The arrangement is the only thing
 * a device changes — and tablet is HOME, because it is the surface where several
 * mobile-width panes are composed by hand, which is the act the other two are
 * projections of.
 *
 * Read the three as one sentence: tablet is where composition is DESIGNED,
 * mobile proves each pane is valid ALONE, desktop proves the same panes compose
 * side by side. That is the dimensional test, and it comes almost free: every
 * tablet column can be collapsed independently to a mobile viewport, so a pane
 * that fails on mobile is a pane that was never valid on tablet either. */
export const ARRANGEMENTS = Object.freeze({
    MOBILE: {
        panes: 1,
        is: 'one column, one pane — the single-pane PROOF',
        proves: 'that this pane is valid alone',
    },
    TABLET: {
        panes: 'several, each mobile-width',
        is: 'the canonical composition / UX design surface — HOME',
        proves: 'that these panes are valid together, at the width each was designed for',
    },
    DESKTOP: {
        panes: 'the same panes, snapped into a larger workspace',
        is: 'the multi-pane PROJECTION',
        proves: 'that the panes compose when they are all on screen at once',
    },
});

/* Tablet. Not a preference — the surface where the composition is authored. A
 * design solved at desktop first has already spent the X-space it will be judged
 * in, and one solved at mobile first has never seen two panes at once. */
export const CANONICAL_HOME = 'TABLET';

/* ── ARRANGEMENT IS A FUNCTION OF THE DEVICE, AND OF NOTHING ELSE ────────────
 *
 * The refusal this encodes is the important half: `arrangementFor` cannot change
 * WHICH panes exist, because it is not given them. A function that took the pane
 * list could drop one, and a dropped pane is a partition change wearing an
 * arrangement's clothes — which is the bug the owner named. */
export function arrangementFor(device) {
    const key = ARRANGEMENTS[device] ? device : 'MOBILE';
    return { device: key, ...ARRANGEMENTS[key] };
}

/* ── THE GLASS BOUNDARY ──────────────────────────────────────────────────────
 *
 * Glass belongs at exactly ONE boundary, and it means exactly one thing:
 *
 *     PAPER / SOLID   the user's WORKING ARTIFACT — what they are making
 *     GLASS           the INSPECTION / CONTEXT boundary — where they look AT it
 *     UNDER GLASS     EXECUTION, PROVENANCE, Bins, AST, telemetry, system state
 *
 * That is the Looking Glass metaphor expressed as an interaction rule rather
 * than as a surface finish. The test is not "does this look modern" — it is
 * WHICH SIDE OF THE BOUNDARY the content is on:
 *
 *     the thing being worked on        → SOLID, always. Glass over an artifact
 *                                        makes the artifact harder to read in
 *                                        order to say nothing.
 *     the thing being looked THROUGH   → GLASS
 *     the thing that EXECUTED it       → UNDER GLASS, readable but never in
 *                                        front of the work
 *
 * A surface that declares no side is reported, never defaulted: glass applied to
 * an unclassified surface is glass used as decoration, which is the failure this
 * whole clause exists to prevent. */
export const GLASS = Object.freeze({
    PAPER: {
        is: 'the working artifact',
        rule: 'SOLID, always — glass over the work is glass spent saying nothing',
    },
    GLASS: {
        is: 'the inspection / context boundary',
        rule: 'where the user looks AT the work',
    },
    UNDER_GLASS: {
        is: 'execution, provenance, Bins, AST, telemetry, system state',
        rule: 'readable, and never in front of the work',
    },
});

/* The side of the boundary each known surface is on. Declared here so the
 * question is answered once, for the surfaces the owner actually named.
 *
 * A surface NOT in this table is `UNCLASSIFIED` — and an unclassified surface is
 * reported rather than assumed to be GLASS. Assuming it would put a decorative
 * pane over somebody's work on the strength of nobody having looked. */
export const GLASS_SIDE = Object.freeze({
    /* the work */
    canvas: 'PAPER',
    article: 'PAPER',
    document: 'PAPER',
    editor: 'PAPER',
    spreadsheet: 'PAPER',
    /* the boundary — you look at the work through these */
    inspector: 'GLASS',
    tools: 'GLASS',
    drawer: 'GLASS',
    chat: 'GLASS',
    citations: 'GLASS',
    comments: 'GLASS',
    'ai-context': 'GLASS',
    /* beneath — these EXECUTED the work, or say what it is */
    glassbox: 'UNDER_GLASS',
    bins: 'UNDER_GLASS',
    ast: 'UNDER_GLASS',
    telemetry: 'UNDER_GLASS',
    provenance: 'UNDER_GLASS',
    'system-state': 'UNDER_GLASS',
});

export function glassSideFor(surface) {
    const side = GLASS_SIDE[surface];
    return side
        ? { surface, side, ...GLASS[side], classified: true }
        : { surface, side: 'UNCLASSIFIED', classified: false, detail: 'no side of the boundary was declared — glass is not applied on a guess' };
}

/* ── THE LINE LADDER ─────────────────────────────────────────────────────────
 *
 * The owner's reading of the current rig, kept as the owner's reading:
 *
 *     "The outlines in the current rig are structural debugging information.
 *      We should not 'style over' them."
 *
 * So the transfer is progressive, and the acceptance test is the one the owner
 * already gave:
 *
 *     REMOVE A STRUCTURAL LINE → does hierarchy remain legible?
 *         NO  → material / depth / spacing are still wrong
 *         YES → remove the next line
 *
 * Toward: structural lines ≈ 0, hierarchy preserved, brand atmosphere preserved,
 * light ↔ dark transition continuous.
 *
 * ── WHY THIS IS ALSO THE WHITE-LABEL CANARY ─────────────────────────────────
 *
 * A hierarchy that survives the line being removed has been carried by MATERIAL,
 * and material is built from tokens. So knock the brand out and the spatial
 * semantics are unchanged — which is the property a white label actually needs.
 * A hierarchy that was carried by a hairline survives the brand knockout
 * perfectly and says nothing about it, because a line is not a token. */
export const LINE_LADDER = Object.freeze(['WIREFRAME', 'MATERIAL', 'FINISHED']);

export const LINE_LADDER_MEANING = Object.freeze({
    WIREFRAME: 'a border says "these are different things"',
    MATERIAL: 'surface / depth / spacing says "these are different things"',
    FINISHED: 'the relationship is understandable without the border',
});

/* The acceptance test, executable. `hierarchyLegible` is the owner's own answer
 * to the one question — it is NOT measured here, because a rule that graded its
 * own legibility would always pass.
 *
 * The other two are carried because the owner carried them: a line removed at
 * the cost of the brand atmosphere or of a continuous light↔dark transition has
 * not been removed, it has been moved somewhere the test does not look. */
export function canRemoveLine({ hierarchyLegible, brandAtmospherePreserved = true, lightDarkContinuous = true } = {}) {
    if (hierarchyLegible !== true) {
        return {
            verdict: 'MATERIAL_STILL_WRONG',
            remove: false,
            detail: 'hierarchy does not survive the line — material / depth / spacing are carrying it, not the line',
            owed: 'raise the surface ladder at this seam before removing anything',
        };
    }
    if (!brandAtmospherePreserved || !lightDarkContinuous) {
        return {
            verdict: 'NOT_A_REMOVAL',
            remove: false,
            detail: 'hierarchy survived, but the brand atmosphere or the light↔dark transition did not — the line was moved, not removed',
            owed: 'restore the atmosphere on the same tokens, then re-test',
        };
    }
    return {
        verdict: 'REMOVE',
        remove: true,
        detail: 'hierarchy is carried by material — remove this line and test the next',
        next: 'LINE_LADDER:FINISHED',
    };
}

/* ── THE ATTACH PATH ─────────────────────────────────────────────────────────
 *
 * The owner's chain, and the reason ANT projection becomes tangible here: when
 * somebody drags an offering, service, tool, person, agent or artifact into
 * their project, they are NOT copying some bespoke UI. They are attaching an
 * ADDRESSABLE PRIMITIVE to the Article, and its capabilities determine what
 * appears in Z2.
 *
 * Declared as ordered steps rather than described in prose, so a surface can say
 * which step it is at — and so a Z2 drawer that appeared without step 4 having
 * resolved permitted tools is visibly out of order rather than merely odd. */
export const ATTACH_PATH = Object.freeze([
    'DRAG_THING_INTO_PROJECT',
    'ATTACH_ID_AND_METADATA',
    'RESOLVE_CAPABILITIES',
    'RESOLVE_PERMITTED_TOOLS',
    'Z2_DRAWER',
    'ESCALATE_DRAWER_TO_FLYOUT_TO_PANE',
    'SAME_PANE_SNAPS_BESIDE_CHAT_ON_DESKTOP',
    'SAME_PANE_OCCUPIES_THE_SCREEN_ON_MOBILE',
]);

/* ── METADATA-RESOLVED TOOLS ─────────────────────────────────────────────────
 *
 * The same Z2 location, the same drawer, the same panes, the same low-level
 * controls — and a different tool set, because the SELECTION's metadata resolved
 * differently. Photoshop-class and Office-class capability comes from composing
 * atomic tools, not from giant product-specific widgets.
 *
 * The three the owner named, kept verbatim as the worked examples: they are the
 * test that the tools really are metadata-resolved rather than three hard-coded
 * drawers that happen to sit in the same place. */
export const RESOLUTION_EXAMPLES = Object.freeze({
    'TEXT NODE': ['typography', 'alignment', 'colour', 'spacing', 'transform', 'styles', 'accessibility'],
    'IMAGE NODE': ['crop', 'resize', 'position', 'mask', 'effects', 'metadata', 'provenance'],
    'EXHIBIT NODE': ['source', 'citation', 'page', 'annotation', 'evidence relationship', 'Bins provenance'],
});

/* ── THE LOW-LEVEL CONTROLS ──────────────────────────────────────────────────
 *
 * Every primitive takes its controls from this set and from nowhere else. A
 * primitive that hand-rolls one is a second control wearing the first one's
 * name: it looks like the others and it is not one of them, and the next surface
 * that copies it copies the divergence too.
 *
 * Glyphs come from lucide and only lucide. One control vocabulary, one icon set,
 * so the whole estate is one system rather than a set of neighbours. */
export const CONTROLS = Object.freeze([
    'Button', 'IconButton', 'Toggle', 'Select', 'Field', 'Slider', 'Tabs', 'Menu',
    'Disclosure', 'Handle', 'DragTarget', 'ResizeHandle', 'DockTarget', 'Close',
    'Pin', 'PopOut', 'Snap', 'Undo', 'Redo',
]);

/* ── THE FRONT DOOR IS BUILT FROM THESE TOO ──────────────────────────────────
 *
 * The owner's chain, kept because it is what makes the editor provable rather
 * than demoed: a real template built in Studio travels all the way out to a Hex
 * offering door and into the marketplace. The marketing artifact IS the
 * high-fidelity editor canary — so the front door is not a second fake website
 * describing what Studio might eventually do. */
export const FRONT_DOOR_PATH = Object.freeze([
    'SDK_ATOMIC_PRIMITIVES',
    'ARTICLE_OR_TEMPLATE',
    'EDIT_WITH_REAL_WYSIWYG_TOOLS',
    'PUBLISHER_COMPOSITION',
    'MICROSITE',
    'HEX_OFFERING_DOOR',
    'MARKETPLACE',
]);

/* ── WHAT IS REFUSED ─────────────────────────────────────────────────────────
 *
 * Named as sentences so a refusal cannot be mistaken for a shortfall. */
export const REFUSALS = Object.freeze([
    'no three responsive versions — one partition, one arrangement function',
    'no new information architecture on desktop — only more X-space for the same panes',
    'a surface that exists only on one device is a PARTITION change wearing an arrangement\'s clothes',
    'glass is a boundary, never decoration — solid over the working artifact, always',
    'an unclassified surface is reported, never assumed to be GLASS',
    'a structural line is REMOVED, never styled over',
    'too many rows is a missing CATEGORY, not a reason to escalate (squishRule.repair)',
    'nothing grows itself — escalate RETURNS a shape, it does not set one',
    'a primitive that hand-rolls a control is a second control wearing the first one\'s name',
    'no feature invents its own responsive implementation — chat, tools, settings, inspector, layers, Bins, Glass Box, citations, comments and AI context all consume the same panes',
]);

/* ── WHAT THIS DOES NOT CLAIM ────────────────────────────────────────────────
 *
 * The owner checked GitHub-visible source before claiming the estate had already
 * implemented this, and did not find those components. That honesty is carried
 * here rather than smoothed over: the contract is declared, and the census of
 * which surfaces satisfy it is OWED. */
export const NOT_CLAIMED = Object.freeze([
    'that any surface in the estate has been READ against this contract — the census is OWED',
    'not yet proven that the component names reported by earlier agents implement this law, in this tree or in any other',
    'that the structural lines have been removed anywhere — the ladder is declared, the work is OWED',
    'not yet proven that every surface has a declared GLASS side',
    'not yet proven that the attach path has been exercised end to end from a drag to a snapped pane',
    'not yet proven that the front door has been rebuilt from these primitives',
]);