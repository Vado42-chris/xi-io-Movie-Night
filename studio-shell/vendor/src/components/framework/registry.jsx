import {
  Globe, Search, LayoutGrid, Activity, BarChart3, User, MessageSquare, Truck, Wallet,
  HardDrive, Scale, Target, Building2, CircuitBoard, Plug, ShoppingBag, Layers,
  Layout, Disc, Palette, Wand2, Users, Coffee, Radio, RadioTower,
  Terminal, ShieldAlert, Ghost, Fingerprint, Settings, Server, Download,
  Home, Network, TrendingUp, Boxes, FileSearch, ScrollText, Workflow, Bot,
  BookOpen, Library, FolderOpen, Kanban, Blocks, Map, Command, ShieldCheck, Database, Crosshair,
  Inbox as InboxIcon, FolderPlus, Table, GitBranch, ListChecks, Gauge, HeartPulse, Rocket, Brain, Puzzle, AppWindow, GitFork, Radar,
  Atom, GitMerge, Bug, Archive, Flame, Braces, Package, Cpu, SlidersHorizontal, Factory,
  Shapes, Newspaper, Cable, ClipboardList, Handshake, Waves, Sparkles, Sigma, Repeat,
} from 'lucide-react';
import { ROTFL } from '@/components/brand/rotfl';
import {
  ANCHOR_ORDER, ANCHORS as ANCHOR_FACTS, TIER_ORDER, TIERS as TIER_FACTS, DECADE_LABELS, isDecadeRung, SCALE_LADDER,
} from '@/lib/pneumaContract';

export { ANCHOR_ORDER, TIER_ORDER };

/* ─────────────────────────────────────────────────────────────
   THE OS REGISTRY — the single brain.
   Every surface of the operating system is declared exactly once,
   here. The sidebar, the desktop, the start menu, the dock and the
   bridge all read from this file. Nothing declares a surface again.

   Each surface carries four facts:
     anchor  — which of the four rails it hangs from
     tier    — how deep into the system it goes
     horizon — how long a job it can run
     colour  — inherited from its anchor, never chosen per surface
   ───────────────────────────────────────────────────────────── */

/* The rails, the tiers and the scale ladder are CANONICAL — they live in
   @/lib/pneumaContract and are read from there, never re-declared here. What
   this file adds is presentation only: the glyph and the colour each rail
   wears. Integration hostile E fails if this file grows its own copy again. */
export const ANCHORS = {
  /* ROOT wears the BRAND ACCENT — not a hue out of Tailwind's own palette.
   *
   * It was declared indigo-500: a colour nobody chose, on the rail every other
   * rail hangs from and the first one a person looks at. The estate has exactly
   * one owned colour and it is declared once, as --color-brand in index.css.
   * These classes read that token, so the rail, the chip and the atmosphere
   * behind them cannot hold three different opinions about what the brand is. */
  ROOT: { ...ANCHOR_FACTS.ROOT, icon: Globe, colour: 'brand', bg: 'bg-[hsl(var(--color-brand))]', text: 'text-[hsl(var(--color-brand))]' },
  BASE: { ...ANCHOR_FACTS.BASE, icon: Target, colour: 'blue-600', bg: 'bg-blue-600', text: 'text-blue-600' },
  HOME: { ...ANCHOR_FACTS.HOME, icon: Layout, colour: 'rose-500', bg: 'bg-rose-500', text: 'text-rose-500' },
  COMDCCT: { ...ANCHOR_FACTS.COMDCCT, icon: RadioTower, colour: 'neutral-600', bg: 'bg-neutral-600', text: 'text-neutral-600' },
};

export const TIERS = TIER_FACTS;

/* The decade row only. A horizon is how long a job a surface can run is — a
   SCALE question — so the operator rungs (2s-5s) are not offered here. The two
   rows are declared by the contract; this file does not split them itself. */
export const HORIZONS = DECADE_LABELS;

/* A surface's horizon is a rung of the decade row, or it is UNKNOWN. A value
   the ladder does not carry is not drawn as though it did. */
export const horizonOf = (surface) =>
  (isDecadeRung(surface?.horizon) ? surface.horizon : 'UNKNOWN');

/* ── WHAT THE DESKTOP MAY OPEN — declared once, read by every consumer.
 *
 * This is a declaration, and a declaration is a dependency: every surface that
 * lists or launches an item asks this question. It used to be answered by a
 * bare 'product' literal written separately in four files — the projection
 * that minted it, the desktop that filtered it, the desktop that launched it,
 * and the grid that drew it. Four copies of one assumption is four chances to
 * disagree, and they did disagree: the apps filter kept 'app' and dropped
 * 'product', so selecting it removed all nine canonical products from the
 * field. Patching that one filter moved one dependent and left three reading
 * the old assumption, which is how a dependency never finishes.
 *
 * A product of the estate IS an application you launch. It is named here so
 * the fact lives in one place, and a consumer that wants to know whether it
 * may open something asks rather than decides. */
export const PRODUCT_TYPE = 'product';
export const OPENABLE_TYPES = Object.freeze(['app', PRODUCT_TYPE]);

/* An item with no type is an application: the desktop's own icons predate the
   type field and were always openable. */
export const isOpenable = (item) =>
  !item?.type || OPENABLE_TYPES.includes(item.type);

/* The kernel's own name and brand, declared here so nothing else spells them out. */
export const KERNEL = {
  name: 'PNEUMA',
  mark: ROTFL.mark,
  letters: ROTFL.letters,
};

export const HORIZON_NOTES = Object.fromEntries(
  SCALE_LADDER.map((rung) => [rung.label, rung.note]),
);

/* route: the page this surface opens. null = it only exists on the desktop.

   One glyph, one meaning. Every icon below is used exactly once — in this file,
   on the sidebar, on the desktop and in the start menu alike. A glyph that
   stands for two different things is a glyph the user has to guess at, and
   guessing is the opposite of an operating system. */
export const SURFACES = [
  // ── ROOT ────────────────────────────────────────────────────
  { id: 'Home', name: 'Gateway', route: 'Home', anchor: 'ROOT', tier: 'BRONZE', horizon: '10s', icon: Home, plain: 'Where you start, and what the estate is doing' },
  { id: 'SearchResults', name: 'Web Search', route: 'SearchResults', anchor: 'ROOT', tier: 'BRONZE', horizon: '100s', icon: Search, plain: 'Search the open web from inside the estate' },
  { id: 'Dashboard', name: 'Overview', route: 'Dashboard', anchor: 'ROOT', tier: 'SIVER', horizon: '100s', icon: LayoutGrid, plain: 'Your key numbers in one place' },
  { id: 'Analytics', name: 'Analytics', route: 'Analytics', anchor: 'ROOT', tier: 'SIVER', horizon: '1,000s', icon: TrendingUp, plain: 'Traffic and usage over time' },
  { id: 'Intelligence', name: 'Intelligence', route: 'Intelligence', anchor: 'ROOT', tier: 'GOLD', horizon: '1,000s', icon: BarChart3, plain: 'Insights drawn from your own data' },
  { id: 'CRM', name: 'CRM', route: 'CRM', anchor: 'ROOT', tier: 'SIVER', horizon: '100s', icon: User, plain: 'Contacts, customers and their history' },
  { id: 'Communications', name: 'Comms', route: 'Communications', anchor: 'ROOT', tier: 'BRONZE', horizon: '100s', icon: MessageSquare, plain: 'Messages, campaigns and social' },
  { id: 'Commerce', name: 'Commerce', route: 'Commerce', anchor: 'ROOT', tier: 'SIVER', horizon: '100s', icon: Truck, plain: 'Products, orders and stock' },
  { id: 'Finance', name: 'Finance', route: 'Finance', anchor: 'ROOT', tier: 'GOLD', horizon: '1,000s', icon: Wallet, plain: 'Money in, money out, and what is owed' },
  { id: 'Archives', name: 'Archives', route: 'Archives', anchor: 'ROOT', tier: 'BRONZE', horizon: '10,000s', icon: HardDrive, plain: 'Long-term storage and old versions' },
  { id: 'Legal', name: 'Legal', route: 'Legal', anchor: 'ROOT', tier: 'SIVER', horizon: '10,000s', icon: Scale, plain: 'Matters, documents and obligations' },
  /* The case studies. It hangs from ROOT beside the places work happens because
     a case study is read by somebody deciding whether to work here — it is the
     outward face of the estate, not another instrument for measuring it. The
     instruments that PRODUCE these readings are deliberately off the rail; what
     they produced is the one thing that belongs on it. */
  { id: 'Stories', name: 'Case Studies', route: 'Stories', anchor: 'ROOT', tier: 'BRONZE', horizon: '10s', icon: Newspaper, plain: 'What the estate measured about itself, and what it still owes' },

  // ── BASE ────────────────────────────────────────────────────
  { id: 'BusinessPlan', name: 'Business Plan', route: 'BusinessPlan', anchor: 'BASE', tier: 'SIVER', horizon: '10,000s', icon: Map, plain: 'Where the business is going, and the steps to get there' },
  { id: 'Enterprise', name: 'Enterprise', route: 'Enterprise', anchor: 'BASE', tier: 'GOLD', horizon: '10,000s', icon: Building2, plain: 'Company-wide structure, teams and roles' },
  { id: 'Automation', name: 'Automation', route: 'Automation', anchor: 'BASE', tier: 'GOLD', horizon: '1,000s', icon: Workflow, plain: 'Work that runs itself on a trigger or a schedule' },
  { id: 'Integrations', name: 'Integrations', route: 'Integrations', anchor: 'BASE', tier: 'SIVER', horizon: '100s', icon: Plug, plain: 'Connect outside services to the estate' },
  { id: 'IntegrationDashboard', name: 'Integrations Dashboard', route: 'IntegrationDashboard', anchor: 'BASE', tier: 'GOLD', horizon: '1,000s', icon: Layers, plain: 'Health of every connected service' },
  { id: 'Marketplace', name: 'Marketplace', route: 'Marketplace', anchor: 'BASE', tier: 'SIVER', horizon: '1,000s', icon: ShoppingBag, plain: 'Browse and install things other people built' },
  { id: 'ListingAdmission', name: 'Listing Admission', route: 'ListingAdmission', anchor: 'BASE', tier: 'SIVER', horizon: '1,000s', icon: ShieldCheck, plain: 'Admit a product to the shop, or name what it is still owed' },
  /*  THE OFFER, AND THE TERMS 
   *
   * Two questions had no surface anywhere: what the estate does for everyone,
   * and what a concierge tier buys each month. The rail could not answer either
   *  it is ordered by how deep into the system a surface reaches, which is a
   * fact about the surface rather than about what a person gets.
   *
   * It sits in BASE beside the marketplace and the service canary, because the
   * question it answers is commercial: what is offered, what performs it, and
   * what each tier adds. The tiers themselves are declared in
   * src/lib/serviceCatalogue.mjs, and this is the one place they are read. */
  { id: 'Services', name: 'Services & Tiers', route: 'Services', anchor: 'BASE', tier: 'SIVER', horizon: '1,000s', icon: Handshake, plain: 'What we offer everyone, and what each concierge tier adds each month' },
  /* The wiring. It sits beside the marketplace because it answers the question
     the marketplace raises: which of these tools is actually bound to records,
     and which is a shell. It is a reading rather than an instrument for
     measuring the estate, which is why it is the one census on the rail — the
     owner asked to be able to test the families, and a proof nobody can find is
     not a proof. */
  { id: 'Wiring', name: 'The Wiring', route: 'Wiring', anchor: 'BASE', tier: 'GOLD', horizon: '1,000s', icon: Cable, plain: 'Every tool family, the records behind it, and the face it feeds' },
  /* ── THE MAZE, AND WHY IT IS ONE WALL ────────────────────────────────────
   *
   * The editor is being converged on one primitive at a time, and the thing
   * that makes that possible is refusing to walk two walls at once: a walk with
   * two questions in it has no receipts, and when it fails nothing can say which
   * wall failed. So one wall is frozen, read against the estate, and gated; the
   * rest of the work goes on underneath it, undrawn.
   *
   * It sits beside the wiring because it is the same kind of reading — what is
   * actually true, and what is owed — pointed at the editor's own primitives
   * instead of at the tool families. The walls are declared in
   * src/lib/simMaze.mjs and this is the one place they are read. */
  { id: 'SimMaze', name: 'Sim-Maze', route: 'SimMaze', anchor: 'BASE', tier: 'GOLD', horizon: '1s', icon: Map, plain: 'One wall at a time: the current contract, the target, the four bounded paths and the one continue gate' },
  /* The service primitive, and the one round-trip slice that proves it: one real
     Studio template, all of its grey atomic tools, one coloured concierge
     primitive, the same artifact projected into its Hex microsite, and a test
     client UUID provisioned off SEED--001. It hangs from BASE beside the
     marketplace because the question it answers is commercial — what the client
     was provisioned with, and what we do for them — and it is NOT on the rail
     until somebody decides it belongs there. */
  { id: 'ConciergeCanary', name: 'Concierge Service', route: 'ConciergeCanary', anchor: 'BASE', tier: 'SIVER', horizon: '1,000s', icon: Handshake, plain: 'What the software does for you, and what we do with you' },
  /* The API reference was a routed page with no rail: reachable by URL and by
     one button in SmartStart, and so absent from the sidebar, the desktop and
     the start menu, which all read this file. It hangs from BASE because it
     describes the interface the estate exposes outward, next to the surfaces
     that connect it. */
  { id: 'Connect', name: 'Connect AI', route: 'Connect', anchor: 'BASE', tier: 'BRONZE', horizon: '100s', icon: Plug, plain: 'Point an AI you already use at this estate' },
  /* Where the estate's OWN AI is set up: who the mail agent corresponds as, and
     which model answers. It hangs from BASE beside the surfaces that connect the
     estate outward, because configuring the agent is the same question asked of
     the estate's own side of the wire. */
  { id: 'AiSetup', name: 'AI Setup', route: 'AiSetup', anchor: 'BASE', tier: 'BRONZE', horizon: '100s', icon: Sparkles, plain: 'Configure AI Mail and the models the estate answers with' },
  { id: 'ApiDocs', name: 'API Reference', route: 'ApiDocs', anchor: 'BASE', tier: 'BRONZE', horizon: '100s', icon: Braces, plain: 'The entities and endpoints this estate exposes' },
  /* The estate's own metadata, on one surface. Every projection that needed a
     field's shape was keeping its own idea of it; this reads the ONE snapshot the
     schemas generate, and lets a query or a formula be run from it — records are
     one projection of a record, not the whole of it. */
  { id: 'Metadata', name: 'Metadata', route: 'Metadata', anchor: 'BASE', tier: 'BRONZE', horizon: '100s', icon: Sigma, plain: 'Every entity, every field, and the formulas you can run over them' },
  { id: 'BaseWindows', name: 'Window Programs', route: 'BaseWindows', anchor: 'BASE', tier: 'SIVER', horizon: '100s', icon: AppWindow, plain: 'Address every open window' },
  { id: 'FractalAntChains', name: 'Ant Chains', route: 'FractalAntChains', anchor: 'BASE', tier: 'SIVER', horizon: '10,000s', icon: GitMerge, plain: 'Map each receipt ladder to its parent artifact' },

  // ── HOME ────────────────────────────────────────────────────
  { id: 'MyWork', name: 'My Work', route: 'MyWork', anchor: 'HOME', tier: 'BRONZE', horizon: '10s', icon: ClipboardList, plain: 'Your own dockets and tasks — plan the work you chose, and move it on' },
  { id: 'Sprints', name: 'Sprints', route: 'Sprints', anchor: 'HOME', tier: 'BRONZE', horizon: '100s', icon: ListChecks, plain: 'The sprint itself: what is planned, what the ledger actually has, and who is holding it' },
  { id: 'WorkRoom', name: 'Work Room', route: 'WorkRoom', anchor: 'HOME', tier: 'BRONZE', horizon: '1,000s', icon: Kanban, plain: 'Tasks, boards and who is on what' },
  { id: 'DistroBuilder', name: 'Distro Builder', route: 'DistroBuilder', anchor: 'HOME', tier: 'GOLD', horizon: '100,000s', icon: Disc, plain: 'Build and version a distributable of your work' },
  { id: 'Studio', name: 'Studio', route: 'Studio', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Palette, plain: 'Create and edit documents, media and code' },
  { id: 'DraughtTable', name: 'Drafts Table', route: 'DraughtTable', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Table, plain: 'Draft work on the same addressable plane as windows, widgets, tools and the active artifact' },
  /* The whole line, walked in order. Studio makes and Publisher sends; this is
     the surface that holds both halves of producing, forward and back. */
  { id: 'Produce', name: 'Produce', route: 'Produce', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Factory, plain: 'From the first file to what comes back — every step, in order' },
  /* The Studio shell, projected from the control plane the carrier carries
     rather than from a Studio build — because there is no Studio build. It is
     a separate surface from Studio and not a mode of it: the editor composes
     documents, this composes the estate. */
  { id: 'PneumaStudio', name: 'Studio Shell', route: 'PneumaStudio', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Atom, plain: 'The whole estate composed as one workspace' },
  { id: 'ContentManager', name: 'Site Builder', route: 'ContentManager', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Blocks, plain: 'Build and publish pages for a site' },
  { id: 'ComponentForge', name: 'Component Forge', route: 'ComponentForge', anchor: 'HOME', tier: 'GOLD', horizon: '1,000s', icon: Wand2, plain: 'Design and reuse interface components' },
  /* The round-trip canary. It hangs from HOME beside Studio because it is a
     composition surface — one real artifact edited by hand and then walked
     through the whole estate, which is the only way the seams between SDK,
     Articles and Publisher can be shown to hold rather than described. */
  { id: 'RoundTripCanary', name: 'Round-Trip Canary', route: 'RoundTripCanary', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Shapes, plain: 'One artifact, edited by hand, walked through every station and reconciled' },
  /* ── THE TWO-SEAT ROUNDTRIP ──────────────────────────────────────────────
   *
   * It hangs from HOME beside Studio because it is a place work happens: one
   * conversation held by two seats, where the window is where you talk and the
   * pinned seat is where @ibal runs against your own model. It is not a second
   * chat surface — it is the loop between the two, which is the thing that had
   * no home before this. */
  { id: 'Roundtrip', name: 'Roundtrip', route: 'Roundtrip', anchor: 'HOME', tier: 'SIVER', horizon: '100s', icon: Repeat, plain: 'One conversation, two seats: the window you talk in, and the pinned seat that runs on your own model' },
  { id: 'Agents', name: 'Agents', route: 'Agents', anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Bot, plain: 'The workers that act on your behalf' },
  { id: 'Community', name: 'Community', route: 'Community', anchor: 'HOME', tier: 'BRONZE', horizon: '10,000s', icon: Users, plain: 'People, groups and shared work' },
  { id: 'Network', name: 'Network', route: 'Network', anchor: 'HOME', tier: 'GOLD', horizon: '10,000s', icon: Network, plain: 'How your machines and services reach each other' },
  { id: 'Nodes', name: 'Nodes', route: 'Nodes', anchor: 'HOME', tier: 'GOLD', horizon: '10,000s', icon: Boxes, plain: 'The machines this estate runs on' },
  { id: 'Lifestyle', name: 'Lifestyle', route: 'Lifestyle', anchor: 'HOME', tier: 'BRONZE', horizon: '10,000s', icon: Coffee, plain: 'Personal life — home, family and routines' },
  /* Client onboarding. It hangs from HOME beside the surfaces that make things,
     because setting a client up IS the first piece of work — and it is a surface
     of its own rather than a tab of the site builder: what it shows is the whole
     estate a client's project is made of, of which the site is one node. */
  { id: 'Onboarding', name: 'Client Onboarding', route: 'Onboarding', anchor: 'HOME', tier: 'SIVER', horizon: '10,000s', icon: ClipboardList, plain: 'Set a client up: their people, domain, server and site — and what each step still owes' },

  // ── COMDCCT ─────────────────────────────────────────────────
  { id: 'EstateBrain', name: 'Estate Brain', route: 'EstateBrain', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '100s', icon: Brain, adminOnly: true, plain: 'System-wide state and coordination' },
  /* The ledger's door. It sits on the rail next to the surfaces that observe the
     estate, because "which issues does this estate hold, and does the tracker
     hold them too" is an observation, not a setting. */
  { id: 'BugLedger', name: 'Issue Ledger', route: 'BugLedger', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '10,000s', icon: Bug, plain: 'Every issue raised, and whether the trackers hold it' },
  { id: 'Console', name: 'Console', route: 'Console', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '100s', icon: Command, adminOnly: true, plain: 'The live stream of what the system is doing' },
  /* The reading of that stream. Console shows what the system is DOING; this
     shows what it is FAILING AT — every occurrence the estate writes down,
     filterable by which half of Obsidian OS it belongs to and by which side it
     came from. It hangs beside the issue ledger because a log nobody can read
     is how a failure stays silent, and beside the console because the two are
     the same stream read for two different questions. */
  { id: 'Logs', name: 'Logs', route: 'Logs', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '100s', icon: ScrollText, adminOnly: true, plain: 'What the estate is failing at, on both halves of Obsidian OS' },
  { id: 'Emergency', name: 'Emergency', route: 'Emergency', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '1s', icon: ShieldAlert, adminOnly: true, plain: 'Stop everything, now' },
  { id: 'ReaperSpace', name: 'Reaper Space', route: 'ReaperSpace', anchor: 'COMDCCT', group: 'Recover', tier: 'PLATINUM', horizon: '100,000s', icon: Ghost, adminOnly: true, plain: 'Cleanup, recovery and stale-work removal' },
  { id: 'Identity', name: 'Identity', route: 'Identity', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10s', icon: Fingerprint, adminOnly: true, plain: 'Who you are, and what you are allowed to do' },
  { id: 'SovereignAccounts', name: 'Team & Accounts', route: 'SovereignAccounts', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10s', icon: Users, adminOnly: true, plain: 'Invite teammates and admit or suspend accounts' },
  { id: 'DomainRegistry', name: 'Domains', route: 'DomainRegistry', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '1s', icon: Globe, adminOnly: true, plain: 'What this estate owns and when it lapses' },
  /* What you own, as a whole. The register answers what a domain IS and the
     Site Builder answers what is on one page; neither answers "what have I
     got, and how is it doing" — which is the question a person actually
     arrives with. The loose halves are named here rather than left to be
     discovered one surface at a time. */
  { id: 'Sites', name: 'Sites', route: 'Sites', anchor: 'HOME', tier: 'PLATINUM', horizon: '1s', icon: Blocks, plain: 'Every site you own, and how it is doing' },
  { id: 'ApiShop', name: 'API Shop', route: 'ApiShop', anchor: 'ROOT', tier: 'PLATINUM', horizon: '1s', icon: Cable, plain: 'Shop the operations this project needs and register its own API page' },
  { id: 'Settings', name: 'System Config', route: 'Settings', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '100s', icon: Settings, plain: 'How the whole system behaves for everyone' },
  /* The operator's own settings, next to the estate's and deliberately not
     inside it. System Config decides how the machine behaves for everyone;
     this decides how one person's work is saved and what they are told about.
     Filing the second inside the first is how a personal preference comes to
     look like a global one — and how one gets changed by somebody who meant to
     change the other. */
  { id: 'UserSettings', name: 'User Settings', route: 'UserSettings', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '100s', icon: SlidersHorizontal, plain: 'Your own preferences, carried across devices' },
  { id: 'Audit', name: 'System Audit', route: 'Audit', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: FileSearch, adminOnly: true, plain: 'What changed, when, and who did it' },
  { id: 'ServerControl', name: 'Server Control', route: 'ServerControl', anchor: 'COMDCCT', tier: 'GOLD', horizon: '100,000s', icon: Server, plain: 'Start, stop and configure the services behind the estate' },
  { id: 'Installer', name: 'Uplink Installer', route: 'Installer', anchor: 'COMDCCT', group: 'Connect', tier: 'PLATINUM', horizon: '1,000s', icon: Download, plain: 'Connect and install external capabilities' },
  /* The Figma registry seam. It hangs from Connect because it is the same
     question the installer asks — what this estate publishes outward — asked
     of a package rather than of a capability. */
  { id: 'FigmaRegistry', name: 'Figma Registry', route: 'FigmaRegistry', anchor: 'COMDCCT', group: 'Connect', tier: 'PLATINUM', horizon: '1,000s', icon: Package, plain: 'Publish the design system to Figma\'s npm registry' },
  /* The local model bridge. It hangs from Connect for the same reason the
     registry does: it is a question about what crosses the boundary — asked of
     the owner's own machine rather than of a package. */
  { id: 'OllamaBridge', name: 'Local Models', route: 'OllamaBridge', anchor: 'COMDCCT', group: 'Connect', tier: 'PLATINUM', horizon: '1,000s', icon: Cpu, plain: 'Bridge the estate to the models on your own machine' },
  /* Both runtimes, read together. It sits beside Local Models because it answers
     the next question along: that page says how the estate REACHES a local model,
     this one says what the models are actually holding right now and what the
     chart of that history is drawn from. */
  { id: 'SwarmHealth', name: 'Swarm Health', route: 'SwarmHealth', anchor: 'COMDCCT', group: 'Connect', tier: 'GOLD', horizon: '100s', icon: Radar, plain: 'Both local runtimes, what they hold, and what is owed' },
  { id: 'Docs', name: 'Manual', route: 'Docs', anchor: 'COMDCCT', tier: 'BRONZE', horizon: '100s', icon: BookOpen, plain: 'How to use the estate, written down' },
  /* The doctrine. It hangs beside the Manual because it answers the question
     the Manual assumes an answer to: not how to use this, but why it is built
     this way. One permanent artifact, nine stable section addresses, and a
     reader that projects them — the paper is not a page that happens to hold
     the architecture, it IS the architecture, projected for reading. */
  { id: 'Doctrine', name: 'Doctrine', route: 'Doctrine', anchor: 'COMDCCT', tier: 'BRONZE', horizon: '100s', icon: Library, plain: 'The architecture this estate is built on, section by section' },
  /* The registry. It hangs beside the doctrine because it answers the question
     the reader cannot: not what the architecture says, but whether every rule
     it names is actually cited by a section — and which section owes what. */
  { id: 'AxiomRegistry', name: 'Axiom Registry', route: 'AxiomRegistry', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: ListChecks, plain: 'Every invariant, which section cites it, and what is owed' },
  { id: 'WardSecurityCanary', name: 'Ward', route: 'WardSecurityCanary', anchor: 'COMDCCT', group: 'Protect', tier: 'GOLD', horizon: '100s', icon: ShieldCheck, plain: 'Your protection: identity, pass-through and the vault — and what is still owed' },
  { id: 'AckLedger', name: 'Agent Control', route: 'AckLedger', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '1,000s', icon: ScrollText, adminOnly: true, plain: 'Every handshake an agent has made' },
  { id: 'AcsKernel', name: 'Agent Kernel', route: 'AcsKernel', anchor: 'COMDCCT', group: 'Control', tier: 'PLATINUM', horizon: '10,000s', icon: CircuitBoard, adminOnly: true, plain: 'Core agent runtime and control logic' },
  { id: 'Census', name: 'Census', route: 'Census', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: Table, adminOnly: true, plain: 'Every product in the portfolio, counted' },
  { id: 'EstateHistory', name: 'History', route: 'EstateHistory', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '100,000s', icon: ScrollText, plain: 'What this estate has actually done, week by week, with the unrecorded weeks named' },
  { id: 'BlastWave', name: 'Blast Wave', route: 'BlastWave', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '10,000s', icon: Waves, plain: 'The next four weeks read against what is already built, with the contradictions named' },
  { id: 'FeatureCensus', name: 'Promise Census', route: 'FeatureCensus', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '10,000s', icon: ListChecks, adminOnly: true, plain: 'Compare promised features with observed delivery' },
  { id: 'LiveReport', name: 'Live Report', route: 'LiveReport', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '1,000,000s', icon: Gauge, adminOnly: true, plain: "The estate's current state, updating as it runs" },
  { id: 'RecoverySchedule', name: 'Recovery', route: 'RecoverySchedule', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: GitBranch, plain: 'Bring work back after something breaks' },
  { id: 'TriageTunnels', name: 'Triage Tunnels', route: 'TriageTunnels', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '100s', icon: Activity, plain: 'Work that is stuck, stalled or waiting on someone' },
  { id: 'RotflMonitor', name: 'ROTFL Monitor', route: 'RotflMonitor', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '100s', icon: HeartPulse, adminOnly: true, plain: 'Loop health, return and recovery monitor' },
  { id: 'GoldenWindow', name: 'Golden Window', route: 'GoldenWindow', anchor: 'COMDCCT', group: 'Project', tier: 'PLATINUM', horizon: '100s', icon: AppWindow, adminOnly: true, plain: 'Project-start template, drawn from its recipe' },
  { id: 'Burnmap', name: 'Burnmap', route: 'Burnmap', anchor: 'COMDCCT', group: 'Observe', tier: 'PLATINUM', horizon: '100s', icon: Flame, adminOnly: true, plain: 'Health of all 27 maze cells, read live' },
  { id: 'ProductFormation', name: 'Launch Formation', route: 'ProductFormation', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: Rocket, adminOnly: true, plain: 'Take a product from idea to launch' },
  { id: 'SplitBrainAudit', name: 'Split-Brain Audit', route: 'SplitBrainAudit', anchor: 'COMDCCT', group: 'Audit', tier: 'PLATINUM', horizon: '1,000s', icon: Puzzle, adminOnly: true, plain: 'Find conflicting copies of system truth' },
  { id: 'HexProjection', name: 'HEX Projection', route: 'HexProjection', anchor: 'COMDCCT', group: 'Project', tier: 'PLATINUM', horizon: '1,000s', icon: AppWindow, adminOnly: true, plain: 'Project one addressed state into another view' },
  { id: 'DataPlane', name: 'Data Plane', route: 'DataPlane', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: Database, adminOnly: true, plain: 'Where data comes from, goes, and gets stored' },
  { id: 'DesignTruth', name: 'Design Truth', route: 'DesignTruth', anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '10,000s', icon: Crosshair, adminOnly: true, plain: 'Whether the interface matches the design it claims' },
  { id: 'PrimitiveCensus', name: 'Primitive Census', route: 'PrimitiveCensus', anchor: 'COMDCCT', group: 'Audit', tier: 'PLATINUM', horizon: '10,000s', icon: Layers, adminOnly: true, plain: 'Inventory reusable interface and system primitives' },
  { id: 'HotFolders', name: 'Hot Folders', route: 'HotFolders', anchor: 'HOME', tier: 'GOLD', horizon: '1,000s', icon: FolderOpen, plain: 'Folders that process files as they arrive' },
  { id: 'Bins', name: 'Bins', route: 'Bins', anchor: 'ROOT', tier: 'SIVER', horizon: '10,000s', icon: Archive, plain: 'Everything on Drive, with its real path' },
  { id: 'PortfolioCensus', name: 'Portfolio Census', route: 'PortfolioCensus', anchor: 'BASE', tier: 'PLATINUM', horizon: '100,000s', icon: GitFork, adminOnly: true, plain: 'Every repository, and what it is worth keeping' },

  // ── Desktop-only surfaces (no page of their own) ─────────────
  { id: 'FileManager', name: 'File System', route: null, anchor: 'COMDCCT', tier: 'BRONZE', horizon: '10s', icon: FolderOpen, plain: 'Browse and move files', tabs: [{ id: 'files', label: 'Files', icon: FolderPlus }] },
  { id: 'Terminal', name: 'Terminal', route: null, anchor: 'COMDCCT', tier: 'PLATINUM', horizon: '100s', icon: Terminal, plain: 'Run commands directly', tabs: [{ id: 'main', label: 'Terminal', icon: Terminal }] },
  { id: 'SystemMonitor', name: 'System Monitor', route: null, anchor: 'COMDCCT', tier: 'GOLD', horizon: '10s', icon: Activity, plain: 'Live resource use of this machine', tabs: [{ id: 'main', label: 'Monitor', icon: Activity }] },
  { id: 'Switchboard', name: 'Switchboard', route: null, anchor: 'HOME', tier: 'SIVER', horizon: '1,000s', icon: Radio, plain: 'Route agent work to the right lane', tabs: [{ id: 'board', label: 'Agents', icon: Radio }] },
  { id: 'Inbox', name: 'Inbox', route: null, anchor: 'HOME', tier: 'BRONZE', horizon: '100s', icon: InboxIcon, plain: 'Mail and messages waiting on you', tabs: [{ id: 'mail', label: 'Mail', icon: InboxIcon }] },
];

const byAnchor = (anchor) => SURFACES.filter((s) => s.anchor === anchor);
const routed = (list) => list.filter((s) => s.route);

/* The sidebar is two levels, and the second one is optional.
 *
 * L1 is the canonical anchor. L2 is a HUMAN TASK GROUP — "Observe", "Connect",
 * "Protect" — and it exists only where a surface declares one. L3 is the
 * surface itself.
 *
 * L2 used to fall back to the canonical tier, so any surface that had not
 * declared a group was filed under a heading reading "Bronze", "Siver" or
 * "Gold". Fifty-six of the seventy-one surfaces declare no group, so most of
 * the rail was grouped by a lattice classification: a menu whose second level
 * answered "how deep into the system is this" when the person reading it was
 * asking "what is this for".
 *
 * The item labels were already fixed to state purpose. The headings were left
 * stating tier — the same defect one level up, and easier to miss because a
 * heading reads as structure rather than as a label.
 *
 * A surface with no declared group now sits directly under its anchor with no
 * heading at all, because there is nothing to say about it that the anchor has
 * not already said. The tier is still carried on every item and still readable
 * in its tooltip; it simply stops being a menu label. */
export function getNavSections() {
  return ANCHOR_ORDER.map((anchor) => {
    const items = routed(byAnchor(anchor)).map((s) => ({
      id: s.id,
      anchor: s.anchor,
      tier: s.tier,
      horizon: s.horizon,
      name: s.name,
      plain: s.plain || null,
      group: s.group || null,
      icon: s.icon,
      path: s.route,
      theme: ANCHORS[anchor].colour,
      bg: ANCHORS[anchor].bg,
      text: ANCHORS[anchor].text,
      adminOnly: !!s.adminOnly,
    }));
    /* The anchor's own surfaces first, then its declared task groups. An
       ungrouped run is `name: null` — a headingless block, never a group
       called "null" and never a group named after a tier. */
    const groups = [];
    const loose = items.filter((item) => !item.group);
    if (loose.length) groups.push({ name: null, items: loose });
    [...new Set(items.filter((item) => item.group).map((item) => item.group))].forEach((name) => {
      groups.push({ name, items: items.filter((item) => item.group === name) });
    });
    return { anchor, title: ANCHORS[anchor].label, groups, items };
  }).filter((section) => section.items.length > 0);
}

/* ── THE RAIL IS A PROJECTION, NOT THE ROUTE TABLE ───────────────────────────
 *
 * getNavSections() above answers "which surfaces have a route" — every one of
 * them, 69 at the time of writing. It used to BE the left rail, which made
 * "has a route" and "deserves a permanent place in the navigation" the same
 * statement. Every surface added since landed in the rail the moment it got a
 * route, and nobody ever decided that it should.
 *
 * The rail is now its own declaration: the ids below, and only those. A new
 * surface is routed, searchable and on the desktop, and is NOT on the rail
 * until someone adds it here on purpose. That default is the whole change —
 * the list itself is a judgement, and moving a surface is one line.
 *
 * Kept apart from SURFACES deliberately: a flag on each row would leave the
 * default "on" for whoever forgot to write it. getNavSections() is untouched,
 * so the desktop, the current-page lookup and the conservation guard keep
 * reading the full route table.
 *
 * What is NOT on the rail: the instruments that measure, audit and prove the
 * estate (censuses, canaries, ledgers of ledgers), and the second views of a
 * surface that is already here (Integrations Dashboard, Studio Shell). They are
 * still one search away. */
export const RAIL_IDS = Object.freeze([
  // ROOT — the places work happens
  'Home', 'SearchResults', 'Dashboard', 'Analytics', 'Intelligence', 'CRM',
  'Communications', 'Commerce', 'Finance', 'Archives', 'Legal', 'Bins', 'Stories',
  // BASE — the plan and what connects to it
  'BusinessPlan', 'Enterprise', 'Automation', 'Integrations', 'Marketplace', 'Wiring', 'SimMaze', 'AiSetup', 'Metadata', 'Services',
  // HOME — making things
  'WorkRoom', 'Studio', 'Roundtrip', 'Produce', 'ContentManager', 'DistroBuilder', 'Agents',
  'HotFolders', 'Community', 'Network', 'Nodes', 'Lifestyle', 'Onboarding',
  // COMDCCT — running it
  'Console', 'Logs', 'Emergency', 'Identity', 'Settings', 'UserSettings', 'ServerControl',
  'Installer', 'Docs', 'BugLedger',
  /* ── THE INSTRUMENTS, PUT BACK ON THE RAIL ────────────────────────────────
   *
   * These were excluded on purpose, and the note above says why: they "measure,
   * audit and prove the estate" and were left "one search away".
   *
   * That was the wrong call and the cost of it is now exact. Somebody asking
   * "what has this been doing for a year" could not find the instruments that
   * count it, in an app that had the counts in it. A measuring surface nobody
   * can reach is a measurement nobody takes, and a census that lives only behind
   * search reports only to the people who already knew to look for it.
   *
   * The default is unchanged: a surface is still off the rail until somebody
   * puts it here on purpose. These are here on purpose. */
  'EstateHistory', 'BlastWave', 'Census', 'PrimitiveCensus', 'FeatureCensus', 'Audit', 'PortfolioCensus',
]);

const RAIL = new Set(RAIL_IDS);

export function getRailSections() {
  return getNavSections()
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => RAIL.has(item.id)),
      groups: section.groups
        .map((group) => ({ ...group, items: group.items.filter((item) => RAIL.has(item.id)) }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((section) => section.items.length > 0);
}

/* The desktop suites. One suite per anchor — the same four rails. */
export function getSuites() {
  return ANCHOR_ORDER.map((anchor) => ({
    id: `${anchor}Suite`,
    name: ANCHORS[anchor].label,
    description: ANCHORS[anchor].blurb,
    icon: ANCHORS[anchor].icon,
    theme: ANCHORS[anchor].colour,
    type: 'app',
    tabs: routed(byAnchor(anchor)).map((s) => ({ id: s.route, label: s.name, icon: s.icon })),
  })).filter((suite) => suite.tabs.length > 0);
}

/* Surfaces that live only on the desktop. */
export function getDesktopApps() {
  return SURFACES.filter((s) => !s.route).map((s) => ({
    id: s.id,
    name: s.name,
    /* The purpose, not the classification. This read
       `${TIERS[s.tier].label} · ${horizonOf(s)}` — "Platinum · 1,000s" — so the
       start menu described every app by where it sits in the lattice instead of
       what it is for. A tier is a fact about a surface; it is not an answer to
       "what does this do", and printing it there is how the two got confused. */
    description: s.plain || s.name,
    icon: s.icon,
    theme: ANCHORS[s.anchor].colour,
    type: 'app',
    tabs: s.tabs,
  }));
}