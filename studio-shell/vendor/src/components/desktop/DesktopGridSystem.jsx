import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { readHomeFormation } from '@/lib/workspaceStore';
import { durableStringify } from '@/lib/durableJson';
import { useSnapGuideSetter } from '@/lib/snapGuide';
import { toast } from 'sonner';
import { snapToNeighbors } from '@/lib/desktopSnap.mjs';
import { panesFor, paneFromWidget, WIDGET_FOOTPRINTS } from '@/lib/desktopPane.mjs';
import { clampToField } from '@/lib/desktopAccess.mjs';
import { getChromeLayers } from '@/lib/chromeVisibility';
import { nearestFreeCell, overlapsAny, sameRects } from '@/lib/deskField.mjs';

const GridContext = createContext(null);
const PINNED_ITEMS_KEY = 'xiio.desktop.pinned-items/v1';
const WIDGETS_KEY = 'xiio.desktop.widgets/v1';

const readDurableList = (key) => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const writeDurableList = (key, value) => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, durableStringify(value)); } catch {}
};

/* WHERE THE GRID STARTS.
 *
 * One origin for the whole desktop. Every cell is a whole number of units from
 * this point, the drawn grid starts here, and the slot list starts here. There
 * used to be three origins — this one for the first layout, 64/64 for sorting,
 * and the centre of the screen for snapping — which is three different grids
 * wearing one name. An icon placed by one and re-snapped by another moved, and
 * when two of them moved to the same place they drew on top of each other. */
export const GRID_ORIGIN = { x: 48, y: 88 };

/* ── ICON SIZE, IN WHOLE CELLS ─────────────────────────────────────────────
 *
 * A size is a number of grid units, not a pixel value. That is the whole point:
 * a larger icon occupies more cells, so "bigger" is something the grid can
 * reason about — it can be sorted by, and it can be snapped by. A pixel width
 * would be a picture of a size that the grid could not see.
 *
 * The cell a span-N icon sits in is N units across including the gaps inside
 * it, so cells still tile: two one-unit icons and one two-unit icon cover the
 * same ground, and nothing lands half over a neighbour.
 */
export const ICON_SIZE_UNITS = { sm: 1, md: 2, lg: 3 };
export const iconSpan = (item) => ICON_SIZE_UNITS[item?.iconSize] || 1;

/* The taskbar owns the bottom edge and publishes its height as
   --taskbar-height (5.5rem, i.e. 88px). This is that plus a hair of clearance,
   and it is the only reason an icon stops short of the bottom.
 *
 * It used to be 120 — and then a further whole cell was subtracted on top, so
 * the last usable row sat roughly 250px above the bottom of the screen. Icons
 * dragged below that were snapped back up to it, which reads exactly like the
 * grid refusing to let go. */
export const DOCK_ZONE_HEIGHT = 96;

/* The mark lives in the middle of the desktop, and automatic placement routes
   around it. A drag is allowed to cross it: shoving a dropped icon sideways out
   of the mark is what put two icons in one cell, and it is not what any desktop
   does. Module-level so its identity is stable. */
const CENTRAL_ZONE = { width: 600, height: 200 };

export const useGrid = () => {
    const context = useContext(GridContext);
    if (!context) throw new Error("useGrid must be used within a GridProvider");
    return context;
};

/* The grid's starting configuration, declared once.
 *
 * It is a named value rather than an inline object because it is also the merge
 * base a stored configuration is read back onto: a saved value that predates a
 * new setting comes back with the declared default for that setting rather than
 * undefined, so an older layout is still a layout. */
const DEFAULT_GRID_CONFIG = {
    cellSize: 64, // Owner baseline: 64px icon body
    gap: 32,      // 96px pitch, matching the shipped desktop formation
    showGrid: false,
    /* Snapping is a setting now. It used to be the only behaviour there
       was: every drop was rounded to a cell, so there was no way to place
       an icon between two of them — which is a legitimate thing to want,
       and the absence of the option was the complaint. */
    snapEnabled: true,
    opacity: 0.2,
    /* ── THE DESKTOP RESTS ON THE FORMATION ─────────────────────────────────
     *
     * It rested on the ladder — products grouped by brand and laid across the
     * colour spectrum. That is a VISUAL balance, and the desktop's order is not
     * a visual fact: it is the teaching model, and a spectrum ramp is a
     * decoration standing where a curriculum belongs.
     *
     * The formation is the declared relationship graph (see
     * src/lib/desktopFormation.mjs) — two stacks, each one chain, in the order a
     * reader is meant to walk them. Its sequence is OWED to the owner's mockup,
     * and while it is owed the desktop is returned exactly as it arrived: no
     * fallback picks an order so the field "looks organised", because an
     * arrangement invented to fill the gap reads exactly like the real one once
     * it is on screen.
     *
     * The heuristic modes remain below for an operator who explicitly asks for
     * one. What they can no longer do is be the resting state. */
    autoArrange: true,
    sortMode: 'formation', // formation | manual | ladder | name | type | size | brand | color
    /* ── HOW MUCH OF THE FIELD IS DRAWN ─────────────────────────────────────
     * The default is the ORDINARY surface, not the fullest one. The power-user
     * depth is one rung below rather than deleted, and descending only ever
     * adds — see src/lib/desktopDisclosure.mjs. */
    disclosure: 'topology', // first_use | neighbours | topology | expert
    filter: 'all',      // all | apps | files | folders | system
};

export const GridProvider = ({ children }) => {
    /* Read back on load, because the grid IS the layout.
     *
     * Cell size and gap decide where every icon and every panel comes to rest;
     * opacity and the grid lines decide whether you can see the lattice you are
     * placing against; auto-arrange, sort and filter decide what is on the
     * desktop at all. None of it was stored, so a person tuned their desktop
     * and got the declared defaults back on every refresh. */
    const [gridConfig, setGridConfig] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_GRID_CONFIG;
        try {
            const stored = JSON.parse(localStorage.getItem('xi_grid_config') || 'null');
            const migrationKey = 'xiio.desktop.launch-formation/v2';
            const densityMigrationKey = 'xiio.desktop.owner-density/v1';
            const migrated = localStorage.getItem(migrationKey) === 'applied';
            const densityMigrated = localStorage.getItem(densityMigrationKey) === 'applied';
            if (stored && typeof stored === 'object') {
                const next = { ...DEFAULT_GRID_CONFIG, ...stored };
                // eee17018 made first_use the resting Desktop. That hid folders,
                // projects, files and system controls from HOME. Repair that
                // historical default once; after this marker is written an
                // operator may explicitly choose first_use and it will persist.
                if (!migrated && next.disclosure === 'first_use') next.disclosure = 'topology';
                if (!migrated) localStorage.setItem(migrationKey, 'applied');
                /* The old factory density was 96+32 = 128px per step. The owner
                   baseline is visibly a 96px pitch. Migrate ONLY the exact old
                   factory pair once, so an operator's custom density is never
                   overwritten by this repair. */
                if (!densityMigrated && next.cellSize === 96 && next.gap === 32) next.cellSize = 64;
                if (!densityMigrated) localStorage.setItem(densityMigrationKey, 'applied');
                return next;
            }
            if (!migrated) localStorage.setItem(migrationKey, 'applied');
            if (!densityMigrated) localStorage.setItem(densityMigrationKey, 'applied');
            return DEFAULT_GRID_CONFIG;
        } catch {
            return DEFAULT_GRID_CONFIG;
        }
    });

    // Pinned Items (Windows/Widgets pinned to desktop)
    // --- WORKSPACE MANAGEMENT SYSTEM ---

    const DEFAULT_WORKSPACES = [
        {
            id: 'general',
            name: 'General',
            widgets: [
                /* Below the icon formation, on the lattice. These were y: 48 and
                   y: 300 — the first above the lattice's own origin, the second
                   between two rows — and both inside the ground the formation
                   holds, so a fresh desk opened with its own defaults on top of
                   its own icons. The formation is twelve wide and two deep from
                   GRID_ORIGIN, so the first free row is the third. */
                { id: 'clock-main', type: 'clock', position: { x: 48, y: 280 }, size: 'md' },
                { id: 'system-status', type: 'system-status', position: { x: 48, y: 568 }, size: 'sm' }
            ],
            pinnedItems: []
        },
        {
            id: 'dev',
            name: 'Development',
            widgets: [
                { id: 'clock-dev', type: 'clock', position: { x: 1200, y: 48 }, size: 'sm' },
                { id: 'code-pulse', type: 'code-pulse', position: { x: 48, y: 48 }, size: 'lg' },
                { id: 'node-monitor', type: 'node-monitor', position: { x: 1200, y: 200 }, size: 'sm' }
            ],
            pinnedItems: []
        },
        {
            id: 'creative',
            name: 'Creative Studio',
            widgets: [
                { id: 'spotify', type: 'spotify', position: { x: 48, y: 48 }, size: 'md' },
                { id: 'social', type: 'social', position: { x: 1200, y: 48 }, size: 'lg' }
            ],
            pinnedItems: []
        }
    ];

    /* A pin is written to storage, and storage is JSON. A pin handed a live
       React element therefore comes back as a plain object with its type
       stripped off, and the desktop cannot draw it — on every load, because the
       pin is restored every time. One such pin is enough to take the desktop
       down each time it opens.

       Such a pin is dropped here, once, at the boundary it came through: the
       value that cannot be drawn is removed, and every other pin is left exactly
       as it was. A pin that cannot be drawn is one click from being restored by
       hand — guessing what it was meant to be is how a repaired pin ends up
       opening something the operator never pinned. */
    const repairPins = (ws) => ({
        ...ws,
        pinnedItems: (ws.pinnedItems || [])
            .filter((pin) => React.isValidElement(pin.content) || pin.view || pin.type === 'app')
            /* The lane is the lateral order inside the pin band. A pin stored
               before the lane existed has none, and a band with no order is
               exactly the collision the lane replaced — so the order it was
               already stored in becomes the lane order, once. */
            .map((pin, lane) => ({ ...pin, lane: typeof pin.lane === 'number' ? pin.lane : lane })),
    });

    // Initialize Workspaces
    const [workspaces, setWorkspaces] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_WORKSPACES;
        /* A stored value that cannot be read is not a layout. It falls back to
           the declared set rather than taking the desktop down with it — an
           unparseable or emptied store is a broken read, not a decision to have
           no workspaces. */
        try {
            const parsed = JSON.parse(localStorage.getItem('xi_workspaces') || 'null');
            const list = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_WORKSPACES;
            return list.map(repairPins);
        } catch {
            return DEFAULT_WORKSPACES;
        }
    });

    /* The selected workspace must be one that EXISTS.
     *
     * The id was read back from storage and trusted. An id whose workspace had
     * since gone left the desktop drawing one layout while the drawer
     * highlighted none of them — the two disagreed and neither looked wrong. An
     * id that names nothing is not a selection; it falls back to the first
     * workspace that is actually there. */
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => {
        if (typeof window === 'undefined') return workspaces[0].id;
        const stored = localStorage.getItem('xi_current_workspace_id');
        return workspaces.some((w) => w.id === stored) ? stored : workspaces[0].id;
    });

    /* ── PINS AND WIDGETS, FROM THE WORKSPACE OR FROM HOME ────────────────────
     *
     * The workspace store holds these, and the persistence effect below writes
     * them back. But that store is rebuilt from DEFAULT_WORKSPACES whenever its
     * own key is absent or unreadable — and a desk that came up on a rebuilt
     * workspace came up with an EMPTY pin set, so the chat and the widget the
     * operator had standing were gone with no way to tell they had ever been
     * there. HOME is the same durable formation the windows and the icons
     * already ride, so when the workspace store has never been written the pins
     * are read from HOME rather than from nothing.
     *
     * Only when the store is ABSENT. An empty pin list in a store that exists is
     * a decision — the operator closed them — and is never overridden by HOME. */
    const seedFromHome = typeof window !== 'undefined' && !localStorage.getItem('xi_workspaces');
    const homeFormation = seedFromHome ? readHomeFormation() : null;

    const [pinnedItems, setPinnedItems] = useState(() => {
        /* Pin state has its own durable address. Workspace/HOME remain projections
           of the same formation, but they no longer get to erase an explicit pin
           merely because an older workspace snapshot carried an empty array. */
        const durable = readDurableList(PINNED_ITEMS_KEY);
        if (durable) return repairPins({ pinnedItems: durable }).pinnedItems;
        const ws = workspaces.find(w => w.id === currentWorkspaceId) || DEFAULT_WORKSPACES[0];
        if (ws.pinnedItems && ws.pinnedItems.length) return ws.pinnedItems;
        return homeFormation ? repairPins({ pinnedItems: homeFormation.pinnedItems || [] }).pinnedItems : [];
    });

    const [widgets, setWidgets] = useState(() => {
        const durable = readDurableList(WIDGETS_KEY);
        if (durable) return durable;
        const ws = workspaces.find(w => w.id === currentWorkspaceId) || DEFAULT_WORKSPACES[0];
        if (ws.widgets && ws.widgets.length) return ws.widgets;
        return homeFormation?.widgets || [];
    });

    /* ── THE PANES THIS GRID DOES NOT OWN ────────────────────────────────────
     *
     * The snap set is `pinnedItems` plus the drawer — and the OPEN WINDOWS are
     * neither. They live in DesktopEnvironment, because that is where they are
     * opened and closed, so a widget or a pin dragged toward a window could not
     * join it: the window was not in the list, and the list is the only thing
     * the join maths is ever given.
     *
     * So the windows are PUBLISHED here rather than moved. DesktopEnvironment
     * stays the one place that opens them, and this holds only their rects —
     * which is all a join needs. A pane whose rect had to be owned by the grid
     * would be a second owner of the same window.
     *
     * Not persisted with the workspace: an open window is not part of a saved
     * desk, and a stored rect would be a pane claimed at a place nothing is. */
    const [panes, setPanes] = useState([]);

    /* ── THE TWO EDGE PANES, AS BANDS ────────────────────────────────────────
     *
     * The desk's conversation column stands on the left edge and its status rail
     * on the right, both at a HIGHER band than the field (z-panel, above
     * z-window). A window dragged toward either edge therefore travelled UNDER
     * them — and a window under a panel is not merely covered: its title bar is
     * covered with it, so it cannot be grabbed, dragged back out, or closed. It
     * is a window that moved somewhere and stopped being a window, which is the
     * whole of "the windows do not move correctly".
     *
     * The icon layout already reserves both bands (leftBand/rightBand in
     * DesktopEnvironment) so an icon is never placed behind a pane. A WINDOW
     * never asked, so it was the one surface that could come to rest where it
     * could not be reached. The bands are published here and the drop clamp
     * reads them, so both surfaces obey one boundary.
     *
     * Zero by default, so a desk whose edge panes are put away clamps exactly as
     * it did before this existed. */
    const [fieldBands, setFieldBands] = useState({ left: 0, right: 0 });

    /* ── THE GROUND THAT IS ALREADY HELD ─────────────────────────────────────
     *
     * The icons' rects, published by the desk that lays them out. Widgets, seam
     * readouts and anything else that comes to rest on the lattice ask THIS
     * before they choose a cell — see src/lib/deskField.mjs for the rule.
     *
     * The icons win, and that is the desktopAccess law read from the widget's
     * side: a panel may not permanently occlude an icon, so it is the panel that
     * moves. Held as an equal-by-content list, so the desk republishing an
     * unchanged formation on every render costs nothing. */
    const [obstacles, setObstaclesState] = useState([]);
    const setObstacles = useCallback((next) => {
        setObstaclesState((prev) => (sameRects(prev, next) ? prev : next));
    }, []);

    /* ── ONE LATERAL INDEX FOR EVERY COMPOUND DESKTOP SURFACE ───────────────
     *
     * A widget, a pinned pane and an open window are three ARRANGEMENTS of one
     * kind of thing — a surface occupying a rect on the desk — and the snap
     * maths has treated them as one since desktopPane.mjs. The LAYERS did not:
     * each kind had its own band, so a widget was under every window no matter
     * what you did to it, and a pin floated over all of them forever. A widget
     * dragged up against a window therefore vanished behind it, and the join it
     * had just made was the one thing you could not see.
     *
     * One order, keyed on the surface's own id, shared by all three kinds. A
     * surface is raised by being touched and by nothing else, so the thing under
     * the hand is the thing on top — whatever kind of thing it is. */
    const [surfaceOrder, setSurfaceOrder] = useState([]);

    const raiseSurface = useCallback((id) => {
        if (!id) return;
        setSurfaceOrder((prev) => (prev[prev.length - 1] === id ? prev : [...prev.filter((x) => x !== id), id]));
    }, []);

    /* Absent from the order means it has never been touched, which is the
     * bottom of the stack and not an error. */
    const laneOf = useCallback((id) => {
        const i = surfaceOrder.indexOf(id);
        return i === -1 ? 0 : i + 1;
    }, [surfaceOrder]);

    /* ── Persistence ────────────────────────────────────────────────────────
     *
     * Everything the drawer is for is written here, and the dependency list is
     * the whole of the bug this replaced.
     *
     * `workspaces` was NOT a dependency, so this write only happened when the
     * live widgets, the pins, or the selected id changed. Deleting a workspace
     * that was not the selected one changed none of those three — so the delete
     * reached the screen, reached nothing on disk, and the workspace was back
     * on the next load. A save that does not survive a reload is not a save.
     *
     * The grid configuration was not written at all. Cell size, opacity, the
     * grid lines, auto-arrange, sort and filter lived in memory only, so the
     * layout settings a person set were gone every refresh — and the grid is
     * the thing a layout is laid out ON.
     */
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updatedWorkspaces = workspaces.map(ws =>
            ws.id === currentWorkspaceId
                ? { ...ws, widgets, pinnedItems }
                : ws
        );

        /* ── THE PINS AND THE WIDGETS ARE WRITTEN FIRST, AND EACH WRITE STANDS ALONE
         *
         * These five writes were one unguarded run with the pins and widgets at
         * the END of it. The first line is the biggest (every workspace's full
         * contents), so when storage was tight it threw — and the throw skipped
         * the two writes that mattered, took the effect down with it, and left
         * nothing saved. One failure cost ALL of it, which is exactly "they are
         * all not staying pinned".
         *
         * The two small lists that ARE the desk go first, and every other write
         * is isolated so one refusal costs itself and nothing else. */
        writeDurableList(PINNED_ITEMS_KEY, pinnedItems);
        writeDurableList(WIDGETS_KEY, widgets);
        const safely = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
        safely('xi_workspaces', durableStringify(updatedWorkspaces));
        safely('xi_current_workspace_id', currentWorkspaceId);
        safely('xi_grid_config', JSON.stringify(gridConfig));
    }, [workspaces, widgets, pinnedItems, currentWorkspaceId, gridConfig]);

    /* The last word before the page goes. An effect writes AFTER the paint that
       followed a change, so a reload pressed in that gap used to discard the
       newest pin. The latest lists are held in a ref and flushed on the way out. */
    const latestDurable = useRef({ pinnedItems, widgets });
    latestDurable.current = { pinnedItems, widgets };
    useEffect(() => {
        const flush = () => {
            writeDurableList(PINNED_ITEMS_KEY, latestDurable.current.pinnedItems);
            writeDurableList(WIDGETS_KEY, latestDurable.current.widgets);
        };
        window.addEventListener('pagehide', flush);
        return () => window.removeEventListener('pagehide', flush);
    }, []);

    /* A pin above or left of the field has no reachable header, so it can never
       be dragged back. This happened when a pin was made before the desk had been
       measured (the start point was computed from a 0×0 field). Negative is wrong
       at EVERY viewport, so this is the one rescue that is safe to persist. */
    useEffect(() => {
        setPinnedItems((prev) => (prev.some((p) => p.y < 0 || p.x < 0)
            ? prev.map((p) => ((p.y < 0 || p.x < 0)
                ? { ...p, x: Math.max(p.x, GRID_ORIGIN.x), y: Math.max(p.y, GRID_ORIGIN.y) }
                : p))
            : prev));
    }, []);

    // Update the 'workspaces' state when widgets/pins change so we don't lose progress when switching
    useEffect(() => {
        setWorkspaces(prev => prev.map(ws =>
            ws.id === currentWorkspaceId
                ? { ...ws, widgets, pinnedItems }
                : ws
        ));
    }, [widgets, pinnedItems]);


    const switchWorkspace = (id) => {
        const ws = workspaces.find(w => w.id === id);
        if (ws) {
            setCurrentWorkspaceId(id);
            setWidgets(ws.widgets || []);
            setPinnedItems(ws.pinnedItems || []);
            toast.success(`Workspace: ${ws.name}`);
        }
    };

    const createWorkspace = (name) => {
        // "Save State" behavior: Clone current state into new workspace
        const newId = name.toLowerCase().replace(/\s+/g, '-');

        // Check if exists to prevent duplicates or overwrite
        if (workspaces.some(w => w.id === newId)) {
            toast.error("Workspace with this name already exists");
            return;
        }

        const newWs = {
            id: newId,
            name,
            widgets: [...widgets],        // Clone current widgets
            pinnedItems: [...pinnedItems] // Clone current pinned items
        };

        setWorkspaces(prev => [...prev, newWs]);
        setCurrentWorkspaceId(newId); // Switch to it immediately
        toast.success(`Workspace state saved as "${name}"`);
    };

    const saveCurrentWorkspace = () => {
        setWorkspaces(prev => prev.map(ws =>
            ws.id === currentWorkspaceId
                ? { ...ws, widgets, pinnedItems }
                : ws
        ));
        toast.success("Workspace state saved");
    };

    const deleteWorkspace = (id) => {
        if (workspaces.length <= 1) {
            toast.error("Cannot delete last workspace");
            return;
        }
        const newWorkspaces = workspaces.filter(w => w.id !== id);
        setWorkspaces(newWorkspaces);
        if (currentWorkspaceId === id) {
            switchWorkspace(newWorkspaces[0].id);
        }
    };

    /* ── THE GUIDE IS NOT THIS PROVIDER'S STATE ANY MORE ─────────────────────
     *
     * It is held on the desktop rather than inside a window, because a guide
     * drawn inside a panel with overflow-hidden is clipped to the panel it is
     * trying to describe — but "on the desktop" was implemented as "on the
     * desktop's PROVIDER", and that made it expensive.
     *
     * The guide changes several times inside one drag, and it lived in this
     * component's state. Every change therefore re-rendered this provider,
     * rebuilt the context value below — a fresh object literal, so every
     * consumer saw a change — and re-rendered every window and the whole
     * application inside each one, every widget, the icon grid and the desktop.
     * A drag stuttered at exactly the moments it was meant to feel like the
     * window was finding an edge.
     *
     * It lives in its own provider now (src/lib/snapGuide.jsx), mounted above
     * this one in src/Layout.jsx. What is taken from it here is the SETTER,
     * whose identity never changes — so this provider does not re-render when
     * the guide moves, and neither does anything that only writes one. The
     * value is read by SnapGuides, which draws it. */
    const { setGuide: setSnapGuide } = useSnapGuideSetter();

    // Dimensions (Managed by consumer now via resize observer)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const centralZone = CENTRAL_ZONE;

    /* SNAP.
     *
     * Rounds to the nearest cell measured from GRID_ORIGIN, then bounds the
     * result inside the desktop. That is the whole function.
     *
     * It used to snap around the centre of the screen and then push anything
     * that landed on the mark out to a fixed column — so every icon dropped near
     * the middle arrived at the same coordinate and drew on top of its
     * neighbour. It was also applied again on every render to icons that were
     * already placed, which meant a position was never final.
     *
     * Rounding from a fixed origin is idempotent: snapping an already-snapped
     * position returns that same position, so re-running it is harmless. That is
     * what makes the rest of the shell safe to re-run. */
    const snapToGrid = useCallback((x, y, span = 1, footprint = null) => {
        const { cellSize, gap } = gridConfig;
        const totalUnit = cellSize + gap;

        /* Before the shell has been measured there is no bounds to snap against
           — the maths below would return a coordinate near zero and persist it.
           Leave the position alone until there is a desktop to place it on. */
        if (!dimensions.width || !dimensions.height) {
            return { x, y, col: 0, row: 0 };
        }

        let col = Math.round((x - GRID_ORIGIN.x) / totalUnit);
        let row = Math.round((y - GRID_ORIGIN.y) / totalUnit);

        /* A bigger icon snaps to a coarser lattice — the same cells, counted in
           blocks the size of the icon. Rounding a two-unit icon to the one-unit
           grid lets it come to rest straddling a cell boundary, half covering
           whatever is beside it, which is exactly what "not sticking to the
           grid based on size" describes. */
        if (span > 1) {
            col = Math.round(col / span) * span;
            row = Math.round(row / span) * span;
        }

        /* Nothing may come to rest outside the desktop or under the taskbar.
           The bound is the last word, after the rounding — and it is measured
           against the thing's own footprint, not one cell.

           An icon's footprint is `span` whole cells. A pinned window or a widget
           is not an icon: it has no icon span, and it occupies real pixels. So
           it hands its own size in as `footprint`, which is a different fact
           from `span` and is kept as one.

           Two callers were passing a pixel WIDTH into `span` — a unit count. A
           704px panel therefore snapped to a lattice 704 units wide, which
           rounds every position to zero: every panel dragged anywhere on the
           desktop arrived at the grid's origin in the top-left corner. The size
           is a footprint, and it is accepted as one now. */
        const spanX = footprint?.w || span * totalUnit;
        const spanY = footprint?.h || span * totalUnit;
        const maxX = Math.max(GRID_ORIGIN.x, dimensions.width - spanX);
        const maxY = Math.max(GRID_ORIGIN.y, dimensions.height - DOCK_ZONE_HEIGHT - spanY);

        /* Both bounds are the grid's own origin, not zero. Clamping to zero put
           a dragged-to-the-left icon at x=0, which is not a cell boundary — so
           the one place it was guaranteed to land off the grid was the edge. */
        const snappedX = Math.min(Math.max(GRID_ORIGIN.x + col * totalUnit, GRID_ORIGIN.x), maxX);
        const snappedY = Math.min(Math.max(GRID_ORIGIN.y + row * totalUnit, GRID_ORIGIN.y), maxY);

        return { x: snappedX, y: snappedY, col, row };
    }, [gridConfig, dimensions]);

    /* ── WHERE A WIDGET COMES TO REST ────────────────────────────────────────
     *
     * A widget sits on the SAME lattice the icons do, and this is the one place
     * that says which cell. It had three answers before: the drop rounded to a
     * cell, the factory defaults were typed in as x: 48 / y: 48 (which is not a
     * cell — the lattice starts at y: 88), and a widget added from the palette
     * was put at 200 + 20n. Only the first was ever on the grid, and a widget
     * that was not snapped on arrival could never be found on it afterwards.
     *
     * Whole cells, and whole cells INSIDE what is left of the field: never under
     * the chat column or the status rail (the bands), never under the taskbar,
     * and never past the right edge. The bounds are counted in cells rather than
     * applied to the rounded pixel, so the last word is still a cell and not a
     * number that happens to be in range.
     *
     * Before the desktop has been measured there is nothing to snap against, so
     * the position is returned as it came rather than persisted as a guess. */
    const settleWidget = useCallback((x, y, footprint, bands = fieldBands) => {
        const { width, height } = dimensions;
        if (!width || !height) return { x, y };

        const unit = gridConfig.cellSize + gridConfig.gap;
        const minCol = Math.ceil((Math.max(bands.left, GRID_ORIGIN.x) - GRID_ORIGIN.x) / unit);
        const maxCol = Math.max(minCol, Math.floor((width - bands.right - footprint.w - GRID_ORIGIN.x) / unit));
        const maxRow = Math.max(0, Math.floor((height - DOCK_ZONE_HEIGHT - footprint.h - GRID_ORIGIN.y) / unit));

        const col = Math.min(Math.max(Math.round((x - GRID_ORIGIN.x) / unit), minCol), maxCol);
        const row = Math.min(Math.max(Math.round((y - GRID_ORIGIN.y) / unit), 0), maxRow);

        const cell = { x: GRID_ORIGIN.x + col * unit, y: GRID_ORIGIN.y + row * unit };

        /* A cell the icons hold is not a cell. The widget comes to rest in the
           nearest one they do not — so a drop over the formation lands beside
           where the hand was, and a seed saved on top of it is moved off. */
        if (!overlapsAny({ ...cell, w: footprint.w, h: footprint.h }, obstacles)) return cell;

        return nearestFreeCell({
            footprint,
            obstacles,
            from: cell,
            origin: GRID_ORIGIN,
            unit,
            bounds: {
                minX: GRID_ORIGIN.x + minCol * unit,
                maxX: GRID_ORIGIN.x + maxCol * unit,
                minY: GRID_ORIGIN.y,
                maxY: GRID_ORIGIN.y + maxRow * unit,
            },
        }) || cell;
    }, [gridConfig.cellSize, gridConfig.gap, dimensions, fieldBands, obstacles]);

    /* The first cell, at or after `from`, where a widget of this footprint would
       not sit on another one. Scans down a column before moving across, the way
       the icons are laid out. Returns `from` itself when the desktop is full —
       a widget that overlaps is better than a widget that is not placed. */
    const freeCellFor = useCallback((footprint, taken, from, bands = fieldBands) => {
        const { width, height } = dimensions;
        const unit = gridConfig.cellSize + gridConfig.gap;
        /* Taken by another surface, OR held by an icon. The scan is nearest the
           asked-for cell rather than first in reading order, so a widget that
           has to move moves the shortest way. */
        const blocked = [...taken, ...obstacles];
        if (!overlapsAny({ ...from, w: footprint.w, h: footprint.h }, blocked)) return from;
        if (!width || !height) return from;

        return nearestFreeCell({
            footprint,
            obstacles: blocked,
            from,
            origin: GRID_ORIGIN,
            unit,
            bounds: {
                minX: Math.max(bands.left, GRID_ORIGIN.x),
                maxX: width - bands.right - footprint.w,
                minY: GRID_ORIGIN.y,
                maxY: height - DOCK_ZONE_HEIGHT - footprint.h,
            },
        }) || from;
    }, [gridConfig.cellSize, gridConfig.gap, dimensions, fieldBands, obstacles]);

    const snapDimensions = useCallback((width, height) => {
        const { cellSize, gap } = gridConfig;
        const totalUnit = cellSize + gap;
        const cols = Math.round((width + gap) / totalUnit);
        const rows = Math.round((height + gap) / totalUnit);

        return {
            width: Math.max(1, cols) * totalUnit - gap,
            height: Math.max(1, rows) * totalUnit - gap,
            cols: Math.max(1, cols),
            rows: Math.max(1, rows)
        };
    }, [gridConfig]);

    /* ── SNAPPING ONE WINDOW TO ANOTHER ────────────────────────────────────
     *
     * `snapToGrid` above answers "which cell". This answers "which neighbour",
     * and it is the one that lets a chat and a product be brought flush — a
     * join, not a rounding.
     *
     * ── WHAT IS IN THE SET OF NEIGHBOURS ──────────────────────────────────
     *
     * Everything that occupies a rect on the desktop and may be joined — which
     * is a PANE, and it is one category (see src/lib/desktopPane.mjs).
     *
     * It used to be `pinnedItems` alone, and that was a category error rather
     * than a short list: the tool drawer was built as shell furniture, bolted
     * to the right edge of the layout, so it was not in the set and a chat
     * dragged toward it could never be brought flush. The drawer and a pinned
     * chat differ only in which edge of the screen they were assigned.
     *
     * The drawer's rect needs no measurement: it sits immediately outside this
     * field, against its right edge, so its left edge IS this field's right
     * edge. A pane whose rect had to be measured would be missing for the first
     * frame after every resize, and a snap that works only once the layout has
     * settled is a snap that feels broken.
     *
     * The result is bounded HERE rather than in the maths, because the maths
     * knows nothing about the desktop it is placing against: a window pushed
     * flush to a neighbour near the right edge would otherwise be snapped
     * straight off the field.
     */
    const snapPinnedWindow = useCallback((rect, excludeId, opts = {}) => {
        const others = [
            ...pinnedItems.filter((p) => p.id !== excludeId),
            ...widgets.filter((w) => w.id !== excludeId).map(paneFromWidget),
            ...panes.filter((p) => p.id !== excludeId),
            ...panesFor({ field: dimensions, chrome: getChromeLayers() }),
        ].filter((pane) => pane.joinable !== false);

        /* A drop ONTO a pane settles beside it, and never off the field: the
           bounds below are applied after the maths, so without the field here a
           pane dropped on one near the edge would be pushed back on top of it. */
        const field = dimensions.width && dimensions.height
            ? { left: GRID_ORIGIN.x, top: GRID_ORIGIN.y, right: dimensions.width, bottom: dimensions.height - DOCK_ZONE_HEIGHT }
            : null;
        const snapped = snapToNeighbors(rect, others, { ...opts, field });

        if (!dimensions.width || !dimensions.height) return snapped;

        /* ── AND NEVER UNDER AN EDGE PANE ────────────────────────────────────
         *
         * The field's own bounds are not enough. The conversation column and the
         * status rail stand INSIDE the field, on its two edges, at a higher band
         * than a window — so a window clamped only to the field could still come
         * to rest underneath one, with its title bar and its close control
         * covered. That is the desktopAccess law read from the other side: a
         * panel must stay dismissible, and a window is a panel.
         *
         * The bands are what is LEFT of the field once the panes have it, and
         * they are zero when the panes are away — so nothing about a desk with no
         * edge panes changes. */
        const minX = Math.max(GRID_ORIGIN.x, fieldBands.left);
        const maxX = Math.max(minX, dimensions.width - fieldBands.right - rect.w);
        const maxY = Math.max(GRID_ORIGIN.y, dimensions.height - DOCK_ZONE_HEIGHT - rect.h);

        return {
            ...snapped,
            x: Math.min(Math.max(snapped.x, minX), maxX),
            y: Math.min(Math.max(snapped.y, GRID_ORIGIN.y), maxY),
        };
    }, [pinnedItems, widgets, panes, dimensions, fieldBands]);

    /* ── ATTACHED MEANS IT TRAVELS WITH WHAT IT IS ATTACHED TO ─────────────────
     *
     * A join was recorded on the widget (`docked_to`) and nothing ever read it,
     * so two panes brought flush were still two unrelated things: move the
     * window and the widget stayed behind, which is a coincidence of pixels and
     * not an attachment.
     *
     * The host says how far it went and everything recorded as attached to it
     * goes the same distance, kept inside the field so a carried widget can
     * never be taken somewhere its header cannot be reached. A widget dragged
     * away on its own has its record replaced by the move, so it leaves. */
    const carryAttached = useCallback((hostId, dx, dy) => {
        if (!hostId || (!dx && !dy)) return;
        setWidgets((prev) => prev.map((w) => {
            if (w.position?.docked_to !== hostId) return w;
            const pane = paneFromWidget(w);
            const held = clampToField({ x: pane.x + dx, y: pane.y + dy, w: pane.w, h: pane.h }, dimensions);
            return { ...w, position: { ...w.position, x: held.x, y: held.y } };
        }));
    }, [dimensions]);

    /* ── A WIDGET IS NOT KEPT UNDER A PANE ──────────────────────────────────
     *
     * The chat column and the rail stand on the desk's edges at a higher band
     * than the field, so a widget whose saved x falls inside either is present,
     * running, and completely covered. The defaults (x: 48) and every desk saved
     * before the panes existed sit exactly there.
     *
     * This moves such a widget to the nearest free x and touches nothing else:
     * y, size and lock are the operator's. A widget docked to a window follows
     * its host and is left alone. Returns the same array when nothing is covered,
     * so calling it on every measure costs no render. */
    const clearWidgetsFromPanes = useCallback((leftBand, rightBand) => {
        if (!dimensions.width || !dimensions.height) return;
        setWidgets((prev) => {
            const bands = { left: leftBand, right: rightBand };

            /* Onto the lattice as well as out from under the panes. This used to
               move x alone, to `leftBand + 24` — a number that is not a cell — so
               the one time every widget was touched on arrival, it was left off
               the grid.

               A widget already standing in a cell (or docked to something) is a
               SEED: it stays exactly where the operator left it. Only a widget
               that is off the lattice is moved, and if the cell it rounds to is
               taken it goes to the next free one rather than onto its neighbour. */
            const placed = [];
            const loose = [];
            prev.forEach((w) => {
                if (!w.position) return;
                const pane = paneFromWidget(w);
                if (w.position.docked_to) { placed.push(pane); return; }
                const at = settleWidget(pane.x, pane.y, pane, bands);
                if (at.x === pane.x && at.y === pane.y) placed.push(pane);
                else loose.push({ id: w.id, pane, at });
            });
            if (!loose.length) return prev;

            const moved = new Map();
            loose.forEach(({ id, pane, at }) => {
                const spot = freeCellFor(pane, placed, at, bands);
                moved.set(id, spot);
                placed.push({ ...pane, x: spot.x, y: spot.y });
            });

            return prev.map((w) => {
                const spot = moved.get(w.id);
                return spot ? { ...w, position: { ...w.position, x: spot.x, y: spot.y } } : w;
            });
        });
    }, [dimensions.width, dimensions.height, settleWidget, freeCellFor]);

    // Widget Management Actions
    const handleWidgetMove = (id, newPos) => {
        setWidgets(prev => {
            const movedWidget = prev.find(w => w.id === id);
            if (!movedWidget) return prev;

            const target = prev.find(w =>
                w.id !== id &&
                w.type !== 'stack' &&
                Math.abs(w.position.x - newPos.x) < 50 &&
                Math.abs(w.position.y - newPos.y) < 50
            );

            if (target) {
                toast.success("Stack Created");
                const stackId = `stack-${Date.now()}`;
                const stack = {
                    id: stackId,
                    type: 'stack',
                    position: target.position,
                    size: target.size || 'md',
                    widgets: [target, { ...movedWidget, position: { x:0, y:0 } }],
                    activeWidgetId: target.id
                };
                return [
                    ...prev.filter(w => w.id !== id && w.id !== target.id),
                    stack
                ];
            }

            return prev.map(w => w.id === id ? { ...w, position: newPos } : w);
        });
    };

    const handleWidgetResize = (id, direction, delta) => {
        setWidgets(prev => prev.map(w => {
            if (w.id === id) {
                let currentW = w.w;
                let currentH = w.h;

                if (!currentW || !currentH) {
                    if (w.size === 'sm') { currentW = 256; currentH = 128; }
                    else if (w.size === 'lg') { currentW = 384; currentH = 384; }
                    else { currentW = 320; currentH = 256; }
                }

                return {
                    ...w,
                    w: Math.max(200, currentW + delta.x),
                    h: Math.max(100, currentH + delta.y)
                };
            }
            return w;
        }));
    };

    const handleToggleWidgetSize = (id) => {
        const sizes = ['sm', 'md', 'lg'];
        setWidgets(prev => prev.map(w => {
            if (w.id === id) {
                const currentIdx = sizes.indexOf(w.size);
                const nextSize = sizes[(currentIdx + 1) % sizes.length];
                return { ...w, size: nextSize, w: undefined, h: undefined };
            }
            return w;
        }));
    };

    const handleWidgetClose = (id) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
    };

    /* A widget added from the palette lands IN A CELL. Where it was dropped, when
       it was dropped somewhere; otherwise the first cell that is free. It used
       to open at 200 + 20n whatever the grid was — off the lattice and, after the
       third, half over the one before it. */
    const handleAddWidget = (type, drop = null) => {
        const id = `${type}-${Date.now()}`;
        const footprint = WIDGET_FOOTPRINTS.md;
        let position;

        if (!dimensions.width || !dimensions.height) {
            position = { x: 200 + (widgets.length * 20), y: 200 + (widgets.length * 20) };
        } else if (drop && Number.isFinite(drop.x) && Number.isFinite(drop.y)) {
            position = settleWidget(drop.x - footprint.w / 2, drop.y - footprint.h / 2, footprint);
        } else {
            position = freeCellFor(footprint, widgets.map(paneFromWidget), settleWidget(0, 0, footprint));
        }

        setWidgets(prev => [...prev, { id, type, position, size: 'md' }]);
        toast.success(`Widget Added: ${type.toUpperCase()}`);
    };

    const handleStackAction = (stackId, action, payload) => {
        setWidgets(prev => prev.map(w => {
            if (w.id === stackId && w.type === 'stack') {
                if (action === 'setActive') {
                    return { ...w, activeWidgetId: payload };
                }
            }
            return w;
        }));
    };

    const handleWidgetLock = (id) => {
        setWidgets(prev => prev.map(w => w.id === id ? { ...w, locked: !w.locked } : w));
    };

    /* One primitive-settings writer for every desktop widget. The primitive
       registry decides which setting ids a widget exposes; this function only
       persists the selected primitive's addressed value. */
    const handleWidgetSetting = (id, settingId, value) => {
        const key = String(settingId || '').trim();
        if (!key) return;
        setWidgets(prev => prev.map(w => (
            w.id === id
                ? { ...w, settings: { ...(w.settings || {}), [key]: value } }
                : w
        )));
    };

    const addPinnedItem = (item) => {
        /* An unmeasured desk is 0×0, which put the start point at y = -300 — a pin
           created above the screen with its header out of reach. The window's own
           size is the honest fallback until the desk has been measured. */
        const width = dimensions.width || (typeof window !== 'undefined' ? window.innerWidth : 0);
        const height = dimensions.height || (typeof window !== 'undefined' ? window.innerHeight : 0);
        const defaultW = gridConfig.cellSize * 6 + gridConfig.gap * 5;
        const defaultH = gridConfig.cellSize * 4 + gridConfig.gap * 3;
        const startX = width / 2 + 400;
        const startY = height / 2 - 300;
        const snapped = snapToGrid(startX, Math.max(startY, GRID_ORIGIN.y));
        const newItem = {
            id: `pin-${Date.now()}`,
            x: snapped.x,
            y: snapped.y,
            w: defaultW,
            h: defaultH,
            /* A new pin opens on top of the others in its band. */
            lane: pinnedItems.length,
            ...item
        };
        setPinnedItems(prev => {
            // A pin is another view of the same conversation, not a new agent.
            const existing = item.view === 'ibal-bridge' && prev.find(pin =>
                (pin.view === 'ibal-bridge' || (pin.view === 'omni-assistant' && /^@?ibal$/i.test(pin.agentName || ''))) &&
                // Two pins with no conversation are not the same conversation.
                // The fallback made them equal by both being unnamed.
                (pin.conversationRef && pin.conversationRef === item.conversationRef));
            if (!existing) return [...prev, newItem];
            return [...prev.filter(pin => pin.id !== existing.id), { ...existing, ...item }]
                .map((pin, lane) => ({ ...pin, lane }));
        });
    };

    const updatePinnedItem = (id, updates) => {
        setPinnedItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    /* RAISE, along the lateral index.
     *
     * Every pin is on one band — the shell's own — so bringing one to the front
     * is not a matter of raising its z. It is a matter of moving it to the top
     * of the lane order, which is the render order, and renumbering the rest so
     * the lanes stay dense. It used to add 1 to a private integer capped at 20,
     * which put a pin inside the content band, below the taskbar, and left every
     * pin at the cap with no order between them at all: whichever happened to
     * render last won, and that flipped on unrelated state. */
    const raisePinnedItem = (id) => {
        setPinnedItems(prev => {
            const target = prev.find(item => item.id === id);
            if (!target) return prev;
            const rest = prev
                .filter(item => item.id !== id)
                .sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0));
            return [...rest, target].map((item, lane) => ({ ...item, lane }));
        });
    };

    const removePinnedItem = (id) => {
        setPinnedItems(prev => prev.filter(item => item.id !== id));
    };

    const toggleGridLines = () => {
        setGridConfig(prev => ({ ...prev, showGrid: !prev.showGrid }));
    };

    const setGridSize = (size) => {
        setGridConfig(prev => ({ ...prev, cellSize: size }));
    };

    const setGridOpacity = (opacity) => {
        setGridConfig(prev => ({ ...prev, opacity }));
    };

    const setAutoArrange = (autoArrange) => {
        setGridConfig(prev => ({ ...prev, autoArrange }));
    };

    const setSnapEnabled = (snapEnabled) => {
        setGridConfig(prev => ({ ...prev, snapEnabled }));
    };

    const setSortMode = (sortMode) => {
        setGridConfig(prev => ({ ...prev, sortMode }));
    };

    /* How much of the field is drawn. A separate setter from `setSortMode` on
       purpose: depth and sequence are different axes, and a single handler for
       both is how a disclosure change comes to look like a reorder. */
    const setDisclosure = (disclosure) => {
        setGridConfig(prev => ({ ...prev, disclosure }));
    };

    const setFilter = (filter) => {
        setGridConfig(prev => ({ ...prev, filter }));
    };

    /* ── PUTTING A SAVED DESK'S OWN SETTINGS BACK ───────────────────────────
     *
     * A saved desk restores the icons AND the settings that placed them. Without
     * this the icons come back onto a grid whose cell size, gap and sort are
     * whatever the machine happens to be set to now — so a desk saved on one
     * screen comes back as a DIFFERENT arrangement on another, which is the desk
     * not being restored.
     *
     * Merged onto the declared defaults and then the current values, so a desk
     * saved before a setting existed comes back with the declared value for it
     * rather than undefined. */
    const applyGridConfig = (saved) => {
        if (!saved || typeof saved !== 'object') return;
        setGridConfig(prev => ({ ...DEFAULT_GRID_CONFIG, ...prev, ...saved }));
    };

    /* Auto-scale items when the grid metrics change.
     *
     * This re-aligns widgets and pinned windows to the new cell size. It is
     * keyed on the metrics alone — it used to also depend on snapToGrid, whose
     * identity changes whenever the window is measured, so every resize
     * re-snapped every widget and every pinned window and they jumped. */
    useEffect(() => {
        setWidgets(prevWidgets => prevWidgets.map(w => {
            const snapped = snapToGrid(w.position.x, w.position.y);
            return { ...w, position: { x: snapped.x, y: snapped.y } };
        }));

        setPinnedItems(prevPinned => prevPinned.map(p => {
            const snapped = snapToGrid(p.x, p.y);
            const snappedDims = snapDimensions(p.w, p.h);

            return {
                ...p,
                x: snapped.x,
                y: snapped.y,
                w: snappedDims.width,
                h: snappedDims.height
            };
        }));
    }, [gridConfig.cellSize, gridConfig.gap]);

    return (
        <GridContext.Provider value={{
            gridConfig,
            pinnedItems,
            panes,
            setPanes,
            fieldBands,
            setFieldBands,
            obstacles,
            setObstacles,
            freeCellFor,
            surfaceOrder,
            raiseSurface,
            laneOf,
            widgets,
            dimensions,
            snapToGrid,
            settleWidget,
            snapDimensions,
            snapPinnedWindow,
            carryAttached,
            clearWidgetsFromPanes,
            /* The SETTER only. The guide itself is read from its own context by
               the one leaf that draws it — see src/lib/snapGuide.jsx. */
            setSnapGuide,
            centralZone,
            setDimensions,
            addPinnedItem,
            updatePinnedItem,
            raisePinnedItem,
            removePinnedItem,
            handleWidgetMove,
            handleWidgetResize,
            handleToggleWidgetSize,
            handleWidgetClose,
            handleStackAction,
            handleWidgetLock,
            handleWidgetSetting,
            handleAddWidget,
            toggleGridLines,
            setGridSize,
            setGridOpacity,
            setAutoArrange,
            setSnapEnabled,
            setSortMode,
            setDisclosure,
            setFilter,
            applyGridConfig,
            workspaces,
            currentWorkspaceId,
            switchWorkspace,
            createWorkspace,
            saveCurrentWorkspace,
            deleteWorkspace,
        }}>
            {children}
            {/* The lines the icons snap to. This block was lost when the tail of
                this file was cut and re-written: the "show grid" toggle still
                flipped its setting and nothing drew it. Restored verbatim. */}
            {gridConfig.showGrid && (
                <div
                    className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-300"
                    style={{
                        opacity: gridConfig.opacity,
                        backgroundImage: `
                            linear-gradient(to right, #444 1px, transparent 1px),
                            linear-gradient(to bottom, #444 1px, transparent 1px)
                        `,
                        backgroundSize: `${gridConfig.cellSize + gridConfig.gap}px ${gridConfig.cellSize + gridConfig.gap}px`,
                        /* The lines start where the cells start. They were drawn
                           from the centre, which is a different grid from the one
                           the icons snap to — so a cell and the lines you were
                           dragging against never agreed. */
                        backgroundPosition: `${GRID_ORIGIN.x}px ${GRID_ORIGIN.y}px`,
                        maskImage: 'radial-gradient(circle at center, transparent 300px, black 600px)'
                    }}
                />
            )}
        </GridContext.Provider>
    );
};