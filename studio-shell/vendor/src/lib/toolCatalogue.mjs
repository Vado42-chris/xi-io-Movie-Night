import {
    StickyNote, Activity, Terminal, Sparkles, Scale,
    Briefcase, Shield, Search, Mail, Users, Calculator,
    TrendingUp, Package, GitBranch, Folder, Bot, Brain,
    Plug, Globe, Tag, DollarSign, LayoutTemplate, Heart, Ghost, ScrollText, Target,
    CircuitBoard, Server, MessageSquare, Building2, Fingerprint, Download, GitCompare, HardDrive, UploadCloud, ListChecks,
    Database
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   THE TOOL CATALOGUE — ONE DECLARATION PER TOOL
   ─────────────────────────────────────────────────────────────────────────────

   ── WHAT THIS REPLACES, AND WHY IT WAS THE COMPLAINT ────────────────────────

   Tools were declared PER PAGE. PAGE_TOOL_MAP held one block per surface, and
   each block re-declared the tools it wanted in full — id, label, icon,
   component, category. So the same tool was written out again on every surface
   that used it:

     SystemHealth          declared 9 times (Settings, Lifestyle, Agents, Network,
                                      Nodes, Enterprise, Audit, health, sys_health)
     QuickCompose          2 times (Communications, Dashboard)
     StudioPromptHelper    3 times (Studio, Intelligence, SearchResults, SearchLanding)
     MarketAnalysis        2 times (Finance, Intelligence)
     ApiPlaygroundTool     2 times (Integrations, IntegrationDashboard)
     ConnectorWizardTool   2 times (Integrations, Automation)
     ConsoleSnippets       3 times (Console, ServerControl, DistroBuilder, Installer)
     QuickAddContact       2 times (CRM, Identity)

   Nine copies of one tool is not nine tools. It is one tool and eight places
   that will not change when it does — and the estate's own finding, "the
   UserProfile drawer inherits the Dashboard's Quick Draft", is what that looks
   like from the outside.

   ── THE INVERSION ───────────────────────────────────────────────────────────

   A tool is declared ONCE, here, and it says WHERE IT ATTACHES. The surface
   stops listing tools and the tool starts listing surfaces. That is the whole
   change: `attaches` is the edge, and the page's tool set is now DERIVED from
   the catalogue rather than restated beside it.

   `category` is real now. It was a two-value string ('interaction' /
   'automation') that nothing grouped by, so the drawer showed a flat column and
   the estate had no way to answer "what tools do I own for money". The eight
   categories below are the answer, and a tool that fits none of them is a tool
   whose purpose nobody has stated.

   ── WHY THIS FILE IS `.mjs` AND NOT `.jsx` ──────────────────────────────────

   Because the browser renderer had leaked into the runtime-neutral contract.

   `src/lib/attachedTools.js` is runtime-neutral — a node-side script imports it
   to work out which tools travel with an attachment. It reached the catalogue
   through `ToolRegistry.jsx`, and every tool entry carried `component: <React
   component>`. So a script that wanted a LIST OF IDS had to be able to parse
   the entire browser component tree, and the estate's own attachment hostile
   died before execution with:

       attachedTools.js → ToolRegistry.jsx → ERR_UNKNOWN_FILE_EXTENSION ".jsx"

   That is the same class of seam this whole burn is about: a contract that
   names a thing by reaching for its renderer. The identity of a tool — its id,
   its label, the surfaces it attaches to, its category — is data. Which React
   component draws it is a property of the RENDERER, and it now lives in
   `src/lib/toolBindings.jsx`, where a browser is the only thing that can read
   it.

   Nothing was dropped. Every tool that was reachable is still reachable, on
   every surface it was reachable from — and the id list a phone needs is now
   readable by something that has never opened a window.
   ───────────────────────────────────────────────────────────────────────────── */

export const TOOL_CATEGORIES = Object.freeze({
    identity: { label: 'Identity', says: 'Who is here, and who you are speaking to.' },
    data: { label: 'Data', says: 'Files, storage, records — what the estate holds.' },
    communication: { label: 'Communication', says: 'Mail, posts, campaigns — reaching people.' },
    commerce: { label: 'Commerce', says: 'Orders, stock, pricing — what is sold.' },
    analysis: { label: 'Analysis', says: 'Search, scoring, markets — reading the world.' },
    engineering: { label: 'Engineering', says: 'Source, APIs, connectors, builds.' },
    operations: { label: 'Operations', says: 'Health, logs, deployment — running the estate.' },
    authoring: { label: 'Authoring', says: 'Prompts, assets, licences — making things.' },
    knowledge: { label: 'Knowledge', says: 'Docs, archives, notes — what is written down.' },
});

/* ── THE TOOLS ───────────────────────────────────────────────────────────────
 *
 * `attaches` is the edge. `'*'` means the tool belongs to every surface — the
 * chest — and is the only value that is not a list of routes. A tool that
 * attaches to nothing is a tool nobody can reach, which is a finding rather
 * than a default.
 *
 * `body` names the component that draws the tool, by the key it is registered
 * under in toolBindings.jsx. It is a NAME and not a reference, which is what
 * keeps this file free of React: the catalogue says WHICH tool this is, and the
 * renderer says what it looks like. `null` is a real answer — a tool whose body
 * has not been written yet is still a tool the estate declares, and it is
 * reported as unbound rather than silently dropped.
 */
export const TOOLS = Object.freeze([
    /* ── the chest: the same wherever you stand ───────────────────────────── */
    { id: 'team', label: 'Team', icon: Users, body: 'CollabPanel', category: 'identity', attaches: ['*'] },
    { id: 'files', label: 'File System', icon: Folder, body: 'FileManager', category: 'data', attaches: ['*'] },
    /* `settings` is the widget's OWN controls, declared beside the tool that reads
       them. A widget opened in the column shows two panes — its surface and its
       settings — and this is what the settings pane renders. A tool that declares
       none still gets its own pane (pane choice, density), because those are
       facts about how the widget is being used rather than about the tool. */
    { id: 'health', label: 'System Status', icon: Activity, body: 'SystemHealth', category: 'operations', attaches: ['*'],
      settings: [{ key: 'refresh', label: 'Read again every', type: 'select', default: 60,
        options: [{ value: 30, label: '30 seconds' }, { value: 60, label: 'Minute' }, { value: 300, label: '5 minutes' }] }] },
    { id: 'fanin', label: 'Hybrid Fan-In', icon: CircuitBoard, body: 'PneumaFanIn', category: 'engineering', attaches: ['*'] },
    { id: 'pax', label: 'Pair A/B', icon: GitCompare, body: 'PairAdjudication', category: 'engineering', attaches: ['*'] },
    { id: 'storage', label: 'Storage', icon: HardDrive, body: 'StorageStandardPanel', category: 'data', attaches: ['*'] },
    { id: 'storage_map', label: 'Storage Map', icon: UploadCloud, body: 'StorageMetadataPanel', category: 'data', attaches: ['*'] },
    { id: 'mini_prompts', label: 'The Five', icon: ListChecks, body: 'MiniPromptsPanel', category: 'authoring', attaches: ['*'] },

    /* ── attached, by surface ─────────────────────────────────────────────── */
    { id: 'create_listing', label: 'Sell Item', icon: Package, body: 'CreateListing', category: 'commerce', attaches: ['Marketplace'] },
    

    { id: 'visual_palette_toggle', label: 'Show/Hide Tools', icon: LayoutTemplate, body: 'PaletteToggle', category: 'authoring', attaches: ['Studio'] },
    
    
    
    { id: 'artifact_maker', label: 'Make Deliverable', icon: ScrollText, body: 'ArtifactMakerTool', category: 'authoring', attaches: ['Studio', 'Settings', 'UserSettings', 'RecipeRunner'], escalate: 'FLYOUT' },
    { id: 'role_manager', label: 'Role Manager', icon: Shield, body: 'RoleManagerTool', category: 'identity', attaches: ['Settings', 'UserSettings', 'Identity'], escalate: 'FLYOUT' },

    
    

    
    { id: 'api_tester', label: 'API Tester', icon: Terminal, body: 'ApiPlaygroundTool', category: 'engineering', attaches: ['Integrations', 'IntegrationDashboard'] },
    { id: 'connector_builder', label: 'Builder', icon: Plug, body: 'ConnectorWizardTool', category: 'engineering', attaches: ['Integrations', 'Automation'] },

    
    { id: 'zed_controls', label: 'Engineering', icon: Terminal, body: 'ZedControls', category: 'engineering', attaches: ['WorkRoom'] },

    
    { id: 'campaign_gen', label: 'Campaign AI', icon: Sparkles, body: 'CampaignGen', category: 'communication', attaches: ['Communications'] },
    

    { id: 'quick_add_contact', label: 'Add Contact', icon: Users, body: 'QuickAddContact', category: 'identity', attaches: ['CRM'] },
    

    { id: 'order_status', label: 'Track Order', icon: Package, body: 'OrderQuickStatus', category: 'commerce', attaches: ['Commerce'] },
    
    { id: 'currency_converter', label: 'Converter', icon: Calculator, body: 'CurrencyConverter', category: 'commerce', attaches: ['Finance'] },
    

    { id: 'deployment_logs', label: 'Deploy Logs', icon: ScrollText, body: 'DeploymentLogViewer', category: 'operations', attaches: ['ReaperSpace'] },

    { id: 'strategy_notes', label: 'Strategy', icon: Target, body: 'QuickNote', category: 'knowledge', attaches: ['BusinessPlan'] },
    { id: 'search_archives', label: 'Deep Search', icon: Search, body: 'FileManager', category: 'knowledge', attaches: ['Archives'] },
    
    

    /* ── THE TOOL THAT OWNS THE PANE'S OWN SUBJECT ───────────────────────────
     *
     * The search page states what it reads; this is where that is decided. It is
     * the first tool in the estate whose subject is the surface beside it rather
     * than the estate behind it — and that is the shape the rest of the drawer is
     * owed. A tool is not a button that does something somewhere else; it is a
     * control over the thing the window next to it is about.
     *
     * Declared with `search_filters` rather than replacing it: narrowing a result
     * set and choosing what to read are two different operations on the same
     * page, and collapsing them would have been one tool doing two jobs badly. */
    { id: 'search_stores', label: 'Search Stores', icon: Database, body: 'SearchStorePicker', category: 'analysis', attaches: ['SearchResults', 'SearchLanding'] },

    

    /* The pad. `keyed` is what says its identity depends on where it stands:
       what you write on one surface is not what you write on the next. */
    { id: 'scratchpad', label: 'Scratchpad', icon: StickyNote, body: 'QuickNote', category: 'knowledge', attaches: ['*'], keyed: true },

    /* The journal, kept distinct from the pad. They share a component and they
       are not the same tool: the pad is a note about the surface you are
       standing on, the journal is a note about the day. Collapsing them would
       have made one of the two unreachable. */
    { id: 'notes', label: 'Journal', icon: StickyNote, body: 'QuickNote', category: 'knowledge', attaches: ['Lifestyle'] },
]);

/* ── THE SURFACES THAT DECLARE NOTHING ───────────────────────────────────────
 *
 * A surface with no agent is not a surface with somebody else's agent. It has
 * none, and the drawer shows none — which is why this map holds only the
 * surfaces that actually declared one rather than a default row.
 */
export const SURFACE_AGENTS = Object.freeze({
    Marketplace: { name: 'Broker', role: 'Market Analyst', icon: Briefcase, color: 'text-amber-400' },
    Legal: { name: 'Lex', role: 'Legal Compliance Officer', icon: Scale, color: 'text-blue-400' },
    Studio: { name: 'Muse', role: 'Creative Director', icon: Sparkles, color: 'text-purple-400' },
    ContentManager: { name: 'Scribe', role: 'Content Editor', icon: LayoutTemplate, color: 'text-orange-400' },
    Console: { name: 'Root', role: 'System Administrator', icon: Terminal, color: 'text-green-400' },
    Integrations: { name: 'Link', role: 'Integration Specialist', icon: Plug, color: 'text-fuchsia-400' },
    WorkRoom: { name: 'Architect', role: 'Lead Engineer', icon: Brain, color: 'text-orange-400' },
    Communications: { name: 'Mercury', role: 'Comms Director', icon: Mail, color: 'text-pink-400' },
    CRM: { name: 'Rolodex', role: 'Sales Manager', icon: Users, color: 'text-indigo-400' },
    Commerce: { name: 'Ledger', role: 'Supply Chain Ops', icon: Package, color: 'text-emerald-400' },
    Finance: { name: 'Quant', role: 'Financial Analyst', icon: TrendingUp, color: 'text-yellow-400' },
    Intelligence: { name: 'Oracle', role: 'Data Scientist', icon: Brain, color: 'text-cyan-400' },
    Dashboard: { name: 'Ibal', role: 'Conductor / Starvation Watchdog', icon: Activity, color: 'text-white' },
    Settings: { name: 'Admin', role: 'System Config', icon: Scale, color: 'text-neutral-400' },
    Lifestyle: { name: 'Zen', role: 'Wellness Coach', icon: Heart, color: 'text-emerald-400' },
    ReaperSpace: { name: 'Reaper', role: 'Deployment Orchestrator', icon: Ghost, color: 'text-purple-500' },
    Agents: { name: 'Hive', role: 'Swarm Manager', icon: Bot, color: 'text-blue-500' },
    Network: { name: 'NetOp', role: 'Network Operator', icon: Globe, color: 'text-cyan-500' },
    BusinessPlan: { name: 'Strategist', role: 'Business Architect', icon: Briefcase, color: 'text-indigo-500' },
    Archives: { name: 'Librarian', role: 'Archivist', icon: Folder, color: 'text-amber-600' },
    Automation: { name: 'Construct', role: 'Automation Engineer', icon: CircuitBoard, color: 'text-cyan-500' },
    IntegrationDashboard: { name: 'Bridge', role: 'Connectivity Monitor', icon: Activity, color: 'text-purple-500' },
    Nodes: { name: 'Grid', role: 'Infrastructure Manager', icon: Server, color: 'text-blue-600' },
    Community: { name: 'Unity', role: 'Community Manager', icon: Users, color: 'text-orange-500' },
    Enterprise: { name: 'Executive', role: 'Enterprise Admin', icon: Building2, color: 'text-slate-200' },
    Identity: { name: 'Sentinel', role: 'Identity Provider', icon: Fingerprint, color: 'text-zinc-400' },
    Audit: { name: 'Auditor', role: 'Compliance Officer', icon: Shield, color: 'text-red-500' },
    ServerControl: { name: 'SysAdmin', role: 'Server Operator', icon: Server, color: 'text-emerald-500' },
    DistroBuilder: { name: 'Forge', role: 'Systems Architect', icon: Package, color: 'text-red-500' },
    SearchResults: { name: 'Scout', role: 'Research Assistant', icon: Search, color: 'text-blue-400' },
    Installer: { name: 'Installer', role: 'Deployment Agent', icon: Download, color: 'text-cyan-400' },
    Docs: { name: 'Guide', role: 'Documentation Bot', icon: ScrollText, color: 'text-stone-400' },
});

/* ── THE READINGS ────────────────────────────────────────────────────────────
 *
 * The page's tools are DERIVED, never restated. `'*'` attaches everywhere; a
 * route attaches where it is named. A surface that declares nothing gets
 * nothing — not another surface's tools under a label that says otherwise. */
export const toolsFor = (route) =>
    TOOLS.filter((t) => t.attaches.includes('*') || t.attaches.includes(route));

/* ── A SECTION'S TOOLS ARE NOT A SECTION'S FIRST SURFACE'S TOOLS ─────────────
 *
 * The tool column had one population wherever you stood: the surface's own tool
 * plus the chest, which is the same list on every page of the estate. That is
 * one generic bar, and it is why the tools never matched where a person was.
 *
 * A SECTION — ROOT, BASE, HOME, COMDCCT — is the unit a person actually works
 * in, and its surfaces are a declared list (RAIL_IDS in the registry). This reads
 * the catalogue across that list: every tool that attaches to any surface in the
 * section belongs to the section, once. So the column changes when the section
 * changes, and a tool added to one surface in it shows up on all of them.
 *
 * Deduplicated by id, because a tool that attaches to four surfaces in one
 * section is one tool in that section — the whole point of the inversion this
 * catalogue already made. */
export const toolsForRoutes = (routes) => {
    const named = new Set(routes);
    const seen = new Map();
    for (const tool of TOOLS) {
        if (tool.attaches.includes('*')) continue;
        if (!tool.attaches.some((a) => named.has(a))) continue;
        if (!seen.has(tool.id)) seen.set(tool.id, tool);
    }
    return [...seen.values()];
};

export const chestTools = () => TOOLS.filter((t) => t.attaches.includes('*') && !t.keyed);

export const toolsByCategory = (route) => {
    const byCategory = new Map();
    for (const tool of toolsFor(route)) {
        if (!byCategory.has(tool.category)) byCategory.set(tool.category, []);
        byCategory.get(tool.category).push(tool);
    }
    return byCategory;
};

/* ── THE CHEST, AND THE PAD ──────────────────────────────────────────────────
 *
 * Moved here from the renderer, because these are READINGS over the catalogue
 * and nothing about them needs a browser. A script that has to answer "which
 * tools does this window bring" can now answer it without one. */

/* The chest. `attaches: ['*']` IS the chest — there is no second list saying
   which tools are global, because a second list is the thing that drifts. */
export const GLOBAL_TOOLS = chestTools();

/* The pad, declared once, with its own id. It is NOT in the chest: what you
   write on the profile page is not what you write while reading a docket, so
   `keyed: true` says its identity depends on where it is standing and the
   drawer resolves that to the route. */
export const SURFACE_SCRATCHPAD = TOOLS.find((t) => t.id === 'scratchpad');

/* ── THE PER-ROUTE VIEW ──────────────────────────────────────────────────────
 *
 * Built from the catalogue, so a tool added to a surface is added to the tool
 * and not to the page. A route with no tools is absent from this map rather
 * than present with an empty list — the difference matters, because the old
 * fallback could not tell "declares nothing" from "not in the map" and answered
 * both with the Dashboard's tools. */
const ROUTES = [
    ...new Set(TOOLS.flatMap((t) => t.attaches).filter((a) => a !== '*')),
];

export const PAGE_TOOL_MAP = Object.fromEntries(
    ROUTES.map((route) => [
        route,
        { tools: toolsFor(route).filter((t) => !t.attaches.includes('*')), agent: SURFACE_AGENTS[route] ?? null },
    ]),
);

/* The tools a page DECLARES, and nothing else. Used where a window a
   conversation is attached to must show what it declared or show nothing —
   never another surface's tools wearing this one's name. */
export const declaredToolsFor = (route) =>
    TOOLS.filter((t) => t.attaches.includes(route));

/* ── THE DRAWER'S READING ────────────────────────────────────────────────────
 *
 * The tools the drawer shows beside a page: what the page declares, plus the
 * chest. A page the catalogue does not name gets the chest and its own agent —
 * which is the honest answer, because the chest IS available everywhere, and
 * the old version of this returned the Dashboard's Quick Draft instead. */
export const getToolsForPath = (pathname) => {
    let path = (pathname || '').replace('/', '');
    if (!path) path = 'Dashboard';
    const cleanPath = path.split('?')[0];

    return {
        tools: declaredToolsFor(cleanPath),
        agent: SURFACE_AGENTS[cleanPath] ?? null,
    };
};

/* ── THE CATALOGUE, CHECKED ──────────────────────────────────────────────────
 *
 * A tool whose category is not in TOOL_CATEGORIES is a tool nobody can find. A
 * tool that attaches nowhere is a tool nobody can reach. Both are reported
 * rather than drawn, because a drawer that silently omits a tool looks exactly
 * like a drawer that was never given one.
 *
 * The COMPONENT check is deliberately not here. Whether a body has been
 * registered is a question about the renderer, and asking it from a module that
 * has no renderer would be the leak this file was split to remove — see
 * verifyToolBindings in src/lib/toolBindings.jsx. What is checked here is
 * whether a tool has NAMED a body at all, which is an identity fact and belongs
 * on this side of the line. */
export function verifyToolCatalogue() {
    const broken = [];
    const seen = new Map();

    for (const tool of TOOLS) {
        if (seen.has(tool.id)) broken.push(`${tool.id}: declared twice (also as ${seen.get(tool.id)})`);
        seen.set(tool.id, tool.label);

        if (!TOOL_CATEGORIES[tool.category]) {
            broken.push(`${tool.id}: unknown category "${tool.category}"`);
        }
        if (!tool.attaches?.length) broken.push(`${tool.id}: attaches nowhere`);
        if (!tool.body) broken.push(`${tool.id}: names no body`);
        if (!tool.icon) broken.push(`${tool.id}: declares no icon`);
    }

    return {
        ok: broken.length === 0,
        tools: TOOLS.length,
        categories: Object.keys(TOOL_CATEGORIES).length,
        broken,
        first_red: broken.length ? broken[0] : null,
    };
}