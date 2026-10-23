import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls, useMotionValue } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2, GripVertical, Settings, Layout, Command, Cpu, Database, Activity, GitBranch, Layers, Pin, Sparkles } from 'lucide-react';
import { SystemFileBar, SystemFileFrame } from '@/components/framework/sdk';
import ChatDockSlot from '@/components/chat/ChatDockSlot';
import WindowChatLanes from './WindowChatLanes';
import { useChatDock } from '@/lib/chatDockStore';
import { identityOf } from '@/lib/surfaceIdentity.mjs';
import { glassSideFor } from '@/lib/paneContract.mjs';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { cn } from "@/lib/utils";
import { recordEvent } from "@/lib/eventStore";
import { CHROME_ICON } from "@/components/ui/ChromePrimitives";
import { accentCss } from "@/lib/panelShadow";
import { chromaStyle, chromaClass } from "@/lib/chromaMaterial.mjs";
import { useGrid } from './DesktopGridSystem';
import AttachedChips from './AttachedChips';
import { sameGuide } from '@/lib/desktopSnap.mjs';
import { DEFAULT_WINDOW_FOOTPRINT } from '@/lib/desktopPane.mjs';
import './embedded.css';

// A rune is a tab. It always states its name — an icon on its own is a guess,
// and a window you have to guess your way around is not a window.
const Rune = ({ icon, active, label }) => {
    /* A tab may legitimately carry no icon — two callers declare label-only tabs —
       but `<Icon />` with an undefined Icon throws "Element type is invalid" and
       takes the whole desktop down with it, which is exactly what happened. The
       frame's own title bar and glyph both guard their icon; the rune did not.
       A tab with no icon of its own wears the frame's default rather than
       rendering an empty button. */
    const Icon = icon || Layout;
    return (
    <button
        type="button"
        aria-label={label}
        className={cn(
            "w-10 h-10 rounded-none flex items-center justify-center transition-colors duration-200 relative group cursor-pointer border",
            active
                ? "bg-[hsl(var(--color-intent))]/10 border-[hsl(var(--color-intent))] text-[hsl(var(--color-intent))]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] hover:border-border"
        )}
    >
        <Icon className={CHROME_ICON.bar} />
        {active && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[hsl(var(--color-intent))]" />}
        <span className="absolute left-12 top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border rounded-none text-[10px] font-medium text-popover-foreground opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            {label}
        </span>
    </button>
    );
};

/* A window has a floor. Below this it stops being a window and becomes a sliver
   you cannot get hold of again. */
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

export default function WindowFrame(props) {
    return <SystemFileFrame><WindowFrameContent {...props} /></SystemFileFrame>;
}

function WindowFrameContent({
    title, icon: Icon, theme, children, onClose, onMinimize, isActive, onFocus, lane,
    initialPosition, initialSize, onGeometryChange, nativeWindow, titleBarActions, ...props
}) {
    // Local Movie Night adapter: native geometry belongs to the OS window.
    // With no nativeWindow prop, the pinned Studio desktop behavior is retained.
    const isNativeWindow = Boolean(nativeWindow);
    const [internalMaximized, setIsMaximized] = useState(false);
    const isMaximized = isNativeWindow ? nativeWindow.maximized === true : internalMaximized;
    const isNativeFullscreen = isNativeWindow && nativeWindow.fullscreen === true;
    /* ── A SIZE IS TAKEN ONLY IF IT IS ONE ────────────────────────────────────
     *
     * This was `initialSize || { default }`, which accepts ANY truthy object —
     * including `{width: undefined, height: undefined}`, which is what a partial
     * remembered geometry produced. The object was truthy, so the default was
     * skipped and the frame rendered at an undefined width, while the desktop's
     * pane publication fell through its own fallback and told the snap set the
     * window was 1000x700. One window, two rectangles.
     *
     * The size is now taken only when it is a usable one, so the frame and the
     * pane agree on the opening rect by construction rather than by both
     * happening to default to the same number. */
    const [size, setSize] = useState(() => (
        Number.isFinite(initialSize?.width) && initialSize.width > 0
        && Number.isFinite(initialSize?.height) && initialSize.height > 0
            ? initialSize
            : { width: DEFAULT_WINDOW_FOOTPRINT.w, height: DEFAULT_WINDOW_FOOTPRINT.h }
    ));
    const dragControls = useDragControls();

    /* ── THE JOIN MATHS, SHARED WITH THE WIDGETS AND THE PINS ────────────────
     *
     * A window is a pane in exactly the way the other two are — it occupies a
     * rect on the desk and may be joined — but it was the only kind that never
     * asked, so it could never come to rest against anything. See
     * handleWindowDragEnd below. */
    const { snapPinnedWindow, setSnapGuide, carryAttached } = useGrid();

    /* ── HOT: THE WINDOW THAT IS ABOUT TO RECEIVE A CONVERSATION ─────────────
     *
     * The states were the wrong way round. A window's FOCUS was drawn as a
     * lighter, more luminous surface — so the window you were working in read as
     * washed out, and the one you were not read as the correct resting weight.
     * Focus is now an edge and a fire and nothing else, and the luminous surface
     * is reserved for the one moment it means something: a conversation is being
     * dragged over this window and letting go will snap it to this window's edge.
     *
     * It is the whole window that lifts, not an overlay dropped over its content
     * — the rail, the title bar, the reading surface and the footer move together,
     * because what is being said is about the WINDOW and not about one pane in it.
     *
     * The clear is rect-based rather than relatedTarget-based: during a drag most
     * browsers report no relatedTarget at all, so the usual contains() check
     * cleared the state every time the pointer crossed a child element and the
     * window flickered hot and cold as you moved across it. */
    const [hot, setHot] = useState(false);
    const dock = useChatDock();
    const chatDragging = Boolean(dock.dragging);
    const dropProps = {
        onDragEnter: (event) => {
            if (!chatDragging) return;
            event.preventDefault();
            setHot(true);
        },
        onDragOver: (event) => {
            if (!chatDragging) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        },
        onDragLeave: (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX <= rect.left || event.clientX >= rect.right
                || event.clientY <= rect.top || event.clientY >= rect.bottom) setHot(false);
        },
        onDrop: () => setHot(false),
    };
    /* The drag can end anywhere — on another window, on nothing at all — so the
       state is cleared from the drag itself and not only from a drop. */
    useEffect(() => {
        if (!chatDragging) setHot(false);
    }, [chatDragging]);

    /* ── THE PANE'S IDENTITY, AND WHERE IT COMES FROM ────────────────────────
     *
     * The frame drew a TITLE and no category. So the desktop projection of a
     * pane had one of the two names a pane has, and the phone had neither —
     * which is why "category stew" was invisible: nothing was reading a
     * category to stew.
     *
     * `identityOf` is the one resolution, and the mobile column calls the same
     * function, so the two are the same pane by construction rather than by two
     * authors agreeing. See src/lib/surfaceIdentity.mjs.
     *
     * `surfaceId` names the surface this window was opened from; `title` and
     * `category` are the legitimate per-pane overrides — one window may be a
     * pane called "Dockets" inside the SAM LAW category, which is a fact about
     * that window and not about the surface. */
    const identity = identityOf({
        surfaceId: props.surfaceId,
        category: props.category,
        title,
    });

    /* ── WHICH SIDE OF THE GLASS BOUNDARY THIS IS ────────────────────────────
     *
     * paneContract says glass is a BOUNDARY with one meaning, and that a surface
     * declaring no side is REPORTED rather than defaulted — because glass
     * applied to an unclassified surface is glass used as decoration, and glass
     * over the working artifact makes the artifact harder to read in order to
     * say nothing.
     *
     * The canvas is the working artifact, so it is PAPER: solid, always. The
     * frame around it is the boundary you look at the work through. Both are
     * read from the contract rather than asserted here, and both are drawn as
     * declarations, so the reading is a fact about the surface rather than a
     * claim about it. */
    const canvasGlass = glassSideFor('canvas');

    /* The window's own position, as a motion value rather than a prop.
     *
     * The drag writes into these directly, so moving a window never re-renders
     * it — which matters, because "it" is an entire application. Reading them
     * back on drag end is what lets the desktop remember where the window was. */
    const x = useMotionValue(initialPosition?.x ?? 100);
    const y = useMotionValue(initialPosition?.y ?? 100);

    /* Where to return to when a maximized window is restored. */
    const restoreRef = useRef({ x: initialPosition?.x ?? 100, y: initialPosition?.y ?? 100 });

    // Use internal state if no props provided, otherwise controllable
    const [internalActiveTab, setInternalActiveTab] = useState('main');

    // Props for tabs: tabs=[{ id: 'home', icon: Icon, label: 'Home' }]
    const currentTab = isActive ? (props.activeTab || internalActiveTab) : (internalActiveTab);
    const handleTabChange = (tabId) => {
        setInternalActiveTab(tabId);
        if (props.onTabChange) props.onTabChange(tabId);
    };

    const tabs = props.tabs || [
        { id: 'main', icon: Layers, label: 'Main' },
        { id: 'data', icon: Database, label: 'Data' },
        { id: 'git', icon: GitBranch, label: 'Version Control' },
        { id: 'cpu', icon: Cpu, label: 'System' }
    ];

    const frameRef = useRef(null);

    /* Hands the window's current geometry back to the desktop, which keeps it by
       app and hands it back on the next open. Called on the two moments the
       geometry actually changes — the end of a drag and the end of a resize —
       never during them. */
    const reportGeometry = (patch = {}) => {
        if (isNativeWindow || !onGeometryChange) return;
        onGeometryChange({
            x: x.get(),
            y: y.get(),
            width: patch.width ?? size.width,
            height: patch.height ?? size.height,
        });
    };

    /* ── THE DRAG, REDUCED ───────────────────────────────────────────────────
     *
     * A drag produces a pointer position on every frame and ONE movement. That
     * collapse used to happen implicitly — nobody counted the frames, so the
     * only thing the shell could ever say was where the window ended up, and
     * "where it ended up" is not a movement.
     *
     * The count is kept here and handed to the canonical event primitive on drag
     * end, which is what lets the ledger say "N ticks became one operation"
     * rather than asking a reader to believe it. See src/lib/eventPrimitive.mjs.
     *
     * A ref, not state: counting frames in state would re-render the whole window
     * once per frame, which is the exact fault the resize comment above was
     * written about. */
    const dragTicks = useRef(0);
    const dragOrigin = useRef(null);
    const dragStart = useRef(null);

    /* Picked up: lifted out of the well, and the place it was lifted from is
       kept so everything attached to it can be carried the same distance.
       Written to the element, not held in state — picking a window up must not
       re-render the application inside it. */
    const handleWindowDragStart = () => {
        dragStart.current = { x: x.get(), y: y.get() };
        frameRef.current?.setAttribute('data-lifted', 'true');
    };

    const handleWindowDrag = (_event, info) => {
        dragTicks.current += 1;
        if (!dragOrigin.current) {
            dragOrigin.current = {
                x: Math.round(info?.point?.x ?? x.get()),
                y: Math.round(info?.point?.y ?? y.get()),
            };
        }

        /* The line this window is about to land on is drawn while the hand is
           still moving — a join that cannot be seen is indistinguishable from a
           window that moved on its own. */
        const next = snapPinnedWindow(
            { x: x.get(), y: y.get(), w: size.width, h: size.height },
            props.windowId,
            { dragKind: 'window' },
        ).guide;
        setSnapGuide((prev) => (sameGuide(prev, next) ? prev : next));
    };

    const handleWindowDragEnd = () => {
        const from = dragOrigin.current;
        const ticks = dragTicks.current;

        /* ── A WINDOW JOINS LIKE EVERY OTHER PANE ────────────────────────────
         *
         * A widget and a pin have both been able to come to rest flush against a
         * window since the join maths was written; the WINDOW could not join
         * anything, because it was the one kind that never asked. So the
         * relationship ran one way only — a chat could be brought up to a
         * window, but a window could not be brought up to a chat, and two
         * windows could not be brought flush at all. Nothing reported it as a
         * fault, because each half worked perfectly on its own.
         *
         * A JOIN IS TAKEN AS IT IS, and a free drop is left exactly where it was
         * dropped. Windows have never been rounded to the lattice, and rounding
         * them here would be a second change wearing this one's name — so only
         * the join is added. */
        const joined = snapPinnedWindow(
            { x: x.get(), y: y.get(), w: size.width, h: size.height },
            props.windowId,
            { dragKind: 'window' },
        );
        /* The chrome bands are hard field boundaries, not decoration.
         * snapPinnedWindow always returns the position clamped between the
         * top work boundary and the bottom taskbar boundary, whether or not a
         * neighbour join was found. A free drop may remain free of the lattice,
         * but it may never settle underneath shell chrome. */
        x.set(joined.x);
        y.set(joined.y);
        setSnapGuide(null);

        /* Set back into the well, and everything attached to this window goes
           the same distance it went. */
        frameRef.current?.removeAttribute('data-lifted');
        const start = dragStart.current;
        dragStart.current = null;
        if (start) carryAttached(props.windowId, x.get() - start.x, y.get() - start.y);

        const to = { x: Math.round(x.get()), y: Math.round(y.get()) };
        dragOrigin.current = null;
        dragTicks.current = 0;

        reportGeometry();

        /* Only a drag that actually observed something is recorded. A press that
           never moved produces no ticks, and filing it would put an event in the
           ledger for something that did not happen — which is how a ledger stops
           being worth reading. */
        if (!from || ticks === 0) return;

        recordEvent({
            kind: 'semantic',
            source: 'window',
            label: props.title || props.appId || 'Window',
            subject_ref: props.appId || null,
            ticks,
            first: from,
            last: to,
            unit: 'pointer tick',
        });
    };

    /* Maximize is a position change as well as a size change, so both are set
       together. Restoring puts the window back where it was rather than at the
       origin — the two used to be separate pieces of state and only one of them
       came back. */
    const toggleMaximize = () => {
        if (isNativeWindow) {
            if (!isNativeFullscreen) nativeWindow.toggleMaximize();
            return;
        }
        if (isMaximized) {
            x.set(restoreRef.current.x);
            y.set(restoreRef.current.y);
            setIsMaximized(false);
        } else {
            restoreRef.current = { x: x.get(), y: y.get() };
            x.set(0);
            y.set(0);
            setIsMaximized(true);
        }
    };

    const isChromeControl = (event) => Boolean(event.target?.closest?.(
        'button, a, input, select, textarea, summary, [role="button"], [role="menuitem"], [contenteditable="true"], [data-no-window-drag], [data-native-resize]'
    ));
    const startChromeDrag = (event) => {
        onFocus?.(event);
        if (isNativeWindow) {
            if (event.button !== 0 || event.isPrimary === false || event.detail > 1
                || isNativeFullscreen || isChromeControl(event)) return;
            // Cancelling a touch/pen pointerdown suppresses its compatibility
            // mousedown, so one gesture starts exactly one native operation.
            if (event.type === 'pointerdown') event.preventDefault();
            nativeWindow.startDragging();
        } else if (!isMaximized) {
            dragControls.start(event);
        }
    };
    const maximizeFromChrome = (event) => {
        if (isNativeWindow && (event.button !== 0 || isChromeControl(event))) return;
        toggleMaximize();
    };

    // The window manager can consume pointerup while owning a native grab.
    // WebKit then still delivers the next mousedown but may omit pointerdown.
    // Use mouse events for native mouse gestures and pointer events for pen/touch.
    const nativeInputProps = (handler) => ({
        onMouseDown: (event) => {
            if (!event.nativeEvent?.sourceCapabilities?.firesTouchEvents) handler(event);
        },
        onPointerDown: (event) => {
            if (event.pointerType && event.pointerType !== 'mouse') handler(event);
        },
    });
    const chromeDragProps = isNativeWindow
        ? nativeInputProps(startChromeDrag)
        : { onPointerDown: startChromeDrag };

    // Resize Logic
    const isResizing = useRef(false);

    /* RESIZE, FROM EVERY EDGE AND EVERY CORNER.
     *
     * There were three handles — right, bottom, bottom-right — so a window
     * could be pulled outwards from the corner it already had and from nowhere
     * else. A left or top edge that cannot be grabbed is not an edge, it is a
     * wall.
     *
     * The left and top edges move the window as well as sizing it, because that
     * is what dragging that edge does: the far edge stays where it is and the
     * near one follows the hand. That is why the position is written here too,
     * and why it is written as a motion value — the frame follows the pointer
     * exactly, and React is told once, when it is over.
     */
    const startResize = (e, direction) => {
        if (isNativeWindow) {
            if (e.button !== 0 || e.isPrimary === false || isMaximized || isNativeFullscreen) return;
            e.preventDefault();
            e.stopPropagation();
            nativeWindow.startResize(direction);
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        isResizing.current = true;

        const el = frameRef.current;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = el ? el.offsetWidth : size.width;
        const startHeight = el ? el.offsetHeight : size.height;
        const startPosX = x.get();
        const startPosY = y.get();

        const edges = {
            left: direction.includes('left'),
            right: direction.includes('right'),
            top: direction.includes('top'),
            bottom: direction.includes('bottom'),
        };

        let latest = { width: startWidth, height: startHeight };

        // Create overlay to catch all mouse events during resize
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        /* Named band, not a magic number: the catch-all has to sit above the
           window being resized and below anything modal. */
        overlay.style.zIndex = 'var(--z-overlay)';
        overlay.style.cursor = direction === 'left' ? 'w-resize'
            : direction === 'right' ? 'e-resize'
            : direction === 'top' ? 'n-resize'
            : direction === 'bottom' ? 's-resize'
            : `${direction.includes('top') ? 'n' : 's'}${direction.includes('left') ? 'w' : 'e'}-resize`;
        document.body.appendChild(overlay);

        const handleMouseMove = (moveEvent) => {
            if (!isResizing.current) return;

            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newX = startPosX;
            let newY = startPosY;

            if (edges.right) {
                newWidth = Math.max(MIN_WIDTH, startWidth + dx);
            }
            if (edges.bottom) {
                newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
            }
            /* The near edge follows the hand and the far one does not move, so
               the window changes size AND changes place by the amount it grew.
               A left edge that only resized would be dragging the window's own
               right edge instead of the one under the pointer. */
            if (edges.left) {
                newWidth = Math.max(MIN_WIDTH, startWidth - dx);
                newX = Math.max(0, startPosX + (startWidth - newWidth));
            }
            if (edges.top) {
                newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
                newY = Math.max(0, startPosY + (startHeight - newHeight));
            }

            /* Written straight to the node.
             *
             * This used to call setState on every mouse move, and the size was
             * then applied through the animation pipeline — so every frame
             * re-rendered the whole window and everything running inside it, and
             * then eased toward the value the pointer had already passed. That is
             * why the edge lagged the cursor. Now the frame follows the pointer
             * exactly, and React is told once, when the drag is over. */
            if (el) {
                el.style.width = `${newWidth}px`;
                el.style.height = `${newHeight}px`;
            }
            x.set(newX);
            y.set(newY);
            latest = { width: newWidth, height: newHeight };
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.removeChild(overlay);
            setSize(latest);
            reportGeometry(latest);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const resizeHandleProps = (direction) => isNativeWindow
        ? { 'data-native-resize': direction, ...nativeInputProps((event) => startResize(event, direction)) }
        : { onMouseDown: (event) => startResize(event, direction) };

    return (
        <ContextMenu>
        <ContextMenuTrigger asChild>
        <motion.div
            ref={frameRef}
            drag={!isNativeWindow && !isMaximized}
            dragControls={isNativeWindow ? undefined : dragControls}
            dragMomentum={false}
            dragListener={false}
            /* A window is dragged from its title bar and its rail. Without bounds
               it could be dragged clean out of the desktop and left there — off
               the top of the field, unreachable, with no way to bring it back.
               It is now held inside the desktop it belongs to. */
            dragConstraints={isNativeWindow ? undefined : props.constraintsRef}
            dragElastic={0}
            onDragStart={isNativeWindow ? undefined : handleWindowDragStart}
            onDrag={isNativeWindow ? undefined : handleWindowDrag}
            onDragEnd={isNativeWindow ? undefined : handleWindowDragEnd}
            /* ── NO 3D, AND NO BLUR WHILE IT MOVES ────────────────────────
             *
             * The entrance carried `rotateX: 5`, and a 3D rotation on a window
             * is the most expensive thing this shell could ask for: the frame is
             * a `backdrop-filter` surface, so every frame of that rotation
             * re-samples everything behind it AND composites in 3D. Opening a
             * window was the slowest gesture on the desk, and it was slow for a
             * rotation nobody could see.
             *
             * A window now arrives the way every other surface in the estate
             * does — opacity and scale, both owned by the compositor — and it
             * declares itself SETTLING for the length of that arrival, which is
             * what lets the stylesheet drop the backdrop blur for exactly as
             * long as it costs something. See index.css. */
            /* `x` and `y` are the window's DRAG motion values and live in
               `style` below, so the entrance must not touch either: animating
               `y` here would set the drag value to zero and throw the window
               back to the origin it was dragged away from. Opacity and scale
               only — both of which the compositor owns and neither of which the
               drag reads. */
            initial={isNativeWindow ? false : { opacity: 0, scale: 0.94 }}
            animate={isNativeWindow ? undefined : { opacity: 1, scale: 1 }}
            onAnimationStart={() => frameRef.current?.setAttribute('data-settling', 'true')}
            onAnimationComplete={() => frameRef.current?.removeAttribute('data-settling')}
            // Depth is an ordering, not an animation. It used to live inside
            // `animate`, which is the wrong home for it twice over: z-index is not
            // a value you tween, and anything routed through the animation pipeline
            // is applied on the animation's schedule rather than on the click's.
            // As a plain style it takes effect the moment focus moves.
            //
            // Size is here for the same reason. Tweening width and height means a
            // resize is always chasing the pointer instead of being under it, and
            // it re-lays-out the window on every frame of the chase.
            style={{
                /* NO zIndex, and that is the fix rather than an omission.
                 *
                 * This carried `props.zIndex ?? (isActive ? 50 : 10)` — a bare
                 * integer, in a window, on a shell that declares its bands in
                 * tokens precisely so no surface invents a number of its own.
                 * It put every window in the content band, and because an inline
                 * style beats a class it also silently overrode `z-window` on
                 * the layer above, so the declared band was decoration.
                 *
                 * The band is the desktop's single surface stack now — one plane
                 * for widgets, pins and windows alike — and the ORDER inside it
                 * is the lane, shared with the other two kinds. So a window can
                 * sit above a widget and a widget above a window, decided by
                 * which was touched last and by nothing else. Depth is an
                 * ordering, and an ordering is not a number a window should be
                 * inventing; this one is handed in. */
                zIndex: lane,
                x: isNativeWindow ? 0 : x,
                y: isNativeWindow ? 0 : y,
                ...(isNativeWindow ? { top: 0, left: 0, scale: 1 } : {}),
                width: isNativeWindow || isMaximized ? '100%' : size.width,
                height: isNativeWindow ? '100%' : isMaximized ? 'calc(100% - 5.5rem)' : size.height,
                /* The frame carries the window's own colour. It used to be the
                   shell's teal for every window and a plain grey for every
                   unfocused one, so two windows side by side were one object
                   wearing two jobs rather than two things with two identities. */
                /* Hot overrides focus: a window about to receive a conversation
                   states that in its own edge, whatever it was a moment ago. */
                /* The window's own hue, handed to the chroma wrapper. One value
                   and no others: how bright the gloss is and how deep the shadow
                   goes belong to the stylesheet, per reading — see
                   src/lib/chromaMaterial.mjs. */
                ...chromaStyle(theme),
                /* The resting edge is the reading's own border token. It was a
                   literal white, which is a border in the dark shell and
                   nothing at all on a pale one — so an unfocused window lost
                   its edge the moment the light changed. */
                borderColor: hot ? 'hsl(var(--glass-edge) / 0.45)' : isActive ? accentCss(theme, 0.45) : 'hsl(var(--border))',
            }}
            exit={isNativeWindow ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            onPointerDown={onFocus}
            {...dropProps}
            data-hot={hot ? 'true' : 'false'}
            data-native-frame={isNativeWindow ? 'true' : undefined}
            className={cn(
                // `xi-window` carries one rule: the backdrop blur is switched off
                // while this element is being dragged or resized. A backdrop-filter
                // re-samples everything behind it every frame, and a window is a
                // very large thing to re-sample — it is the most expensive property
                // a moving element can hold. See index.css.
                chromaClass(theme, "xi-window xi-desktop-glass xi-embedded absolute flex overflow-hidden"),
                // The frame's own surface — the recessed step. The reading
                // surface inside it is a clear step lighter; see the content
                // container below. These were both the card colour at two
                // opacities, which is ONE value, not two, and that is why the
                // frame and its content could not be told apart.
                /* ── TWO SURFACES: THE RESTING ONE AND THE HOT ONE ─────────────
                 *
                 * Both are rungs of the one luminance ladder, so the lift from
                 * resting to hot is the same step to the eye as the step from a
                 * frame to the content inside it — which is what makes the hot
                 * state read as "this window came forward" rather than as a
                 * different colour somebody liked. */
                hot ? "xi-desktop-glass-hot" : "",
                // Depth is a border. The drop shadows here were doing the same
                // job as the border while also pretending to be a light source
                // above the window — the embossed look, applied to a window.
                //
                // The unfocused state used to be `opacity-90 grayscale-[0.4]`,
                // which did not say "this window is behind another one", it said
                // "this text is hard to read". The light pass already dims itself
                // when the window is not focused; the border and a light scrim are
                // enough here, and everything stays legible.
                "border"
            )}
        >
            {/* ── THE UNFOCUSED SCRIM, AND WHY IT HAD TO MOVE ────────────────
             *
             * This was the LAST child of the window and sat at `z-40`, so it was
             * painted over everything the window contained — the rail, the title
             * bar, the footer AND the working surface. It is a wash of the
             * background colour at 20%, which on the dark reading darkens the
             * artifact and on the LIGHT reading paints 20% white straight across
             * it. Either way the thing a person is reading is behind a film, and
             * on a pale shell it is a film that lifts dark text off its own page.
             *
             * "The window is behind another one" is a statement about the CHROME.
             * The working artifact is PAPER: it stays at full legibility whether
             * or not the window around it has focus, which is the estate's own
             * rule for glass — only the frame, the rail, the title bar and the
             * footer are glass, and only they may be dimmed.
             *
             * So the scrim moves to the BOTTOM of the window's own stack, ahead
             * of everything the window renders. Every chrome band is translucent
             * glass, so the scrim reads through them and the window still settles
             * back when it loses focus. The content surface is opaque, so it
             * MASKS the scrim — the film stops at the edge of the work, which is
             * what "masking out the content area" has to mean. */}
            {!hot && (
                <div className="absolute inset-0 z-0 pointer-events-none bg-background/20" />
            )}

            {/* RESIZE HANDLES — four edges and four corners.
                The corners are declared last so they sit over the edges where
                the two overlap, which is the order they are grabbed in. */}
            {!isMaximized && !isNativeFullscreen && (
                <>
                    {/* THE HANDLES LIVE INSIDE THE WINDOW, and that is the whole
                        of "no true 4-way supports".

                        They were declared 4px OUTSIDE the frame — -left-1,
                        -right-1, -top-1, -bottom-1 — and the frame carries
                        `overflow-hidden`, because a window has to clip its own
                        content. A child at left:-4px is outside the clip, so the
                        four EDGE handles were never drawn and could never be
                        grabbed. The corners survived only because each straddles
                        the boundary and half of it was still inside.

                        So the window resized from its corners and from nowhere
                        else — which is corner-only resizing wearing the shape of
                        four-way. Inset, all eight are now inside the clip and all
                        eight are grabbable. The corners are still declared last
                        so they win where they overlap the edges. */}
                    <div className="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize z-50" {...resizeHandleProps('left')} />
                    <div className="absolute right-0 top-3 bottom-3 w-1.5 cursor-e-resize z-50" {...resizeHandleProps('right')} />
                    <div className="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize z-50" {...resizeHandleProps('top')} />
                    <div className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize z-50" {...resizeHandleProps('bottom')} />

                    <div className="absolute left-0 top-0 w-3 h-3 cursor-nw-resize z-50" {...resizeHandleProps('left-top')} />
                    <div className="absolute right-0 top-0 w-3 h-3 cursor-ne-resize z-50" {...resizeHandleProps('right-top')} />
                    <div className="absolute left-0 bottom-0 w-3 h-3 cursor-sw-resize z-50" {...resizeHandleProps('left-bottom')} />
                    {/* The bottom-right corner keeps its grip mark — it is the
                        handle everyone reaches for, and the mark is how a window
                        says it can be resized at all. */}
                    <div className="absolute right-0 bottom-0 w-5 h-5 cursor-se-resize z-50 group/resize" {...resizeHandleProps('right-bottom')}>
                        <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/40 group-hover/resize:border-foreground transition-colors" />
                    </div>
                </>
            )}

            {/* LEFT RAIL - THE GLYPH PANEL */}
            <div 
                data-window-rail="left"
                className={`window-left-rail w-16 border-r border-border flex flex-col items-center py-6 gap-6 z-20 shrink-0 relative xi-grid cursor-grab active:cursor-grabbing select-none ${hot ? 'xi-desktop-glass-hot' : 'xi-desktop-glass-chrome'}`}
                {...chromeDragProps}
                onDoubleClick={maximizeFromChrome}
            >
                {/* Decorative tint only. The rail's own input handler starts the drag,
                    so this layer must never intercept a click aimed at the controls. */}
                {/* ── THE WINDOW'S COLOUR, ON ITS OWN CHROME ───────────────────
                 *
                 * This was 6% — a tint nobody can see, which is why every window
                 * on the desk read as the same grey plate no matter how
                 * differently it was themed. The hue was declared, resolved and
                 * applied, and then laid down at a strength that rounds to
                 * nothing.
                 *
                 * The WORK stays opaque paper — that is the owner's own rule and
                 * it is the right one, because a wash across the page is what
                 * made content unreadable before. This is the other half of that
                 * rule: the FRAME says whose window it is, at a strength that can
                 * actually be seen, and the artifact inside it is untouched. */}
                <div className="absolute inset-x-0 top-0 h-full pointer-events-none" style={{ background: accentCss(theme, 0.16) }} />

                {/* App Glyph — held at its own size. It is a mark, not a
                    flexible row, and must never be the thing that gives way when
                    the rail is short of room. */}
                <div className="window-rail-glyph mt-2 mb-4 shrink-0 relative group/glyph">
                    {/* Bare glyph, sized so the rail's geometry does not move. No
                        plate and no hairline behind it. */}
                    <div className="w-10 h-10 rounded-none flex items-center justify-center text-white relative z-10">
                        {Icon ? <Icon className={CHROME_ICON.bar} /> : <Layout className={CHROME_ICON.bar} />}
                    </div>
                    {/* Tooltip Title */}
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border rounded-none text-[10px] font-medium text-white opacity-0 group-hover/glyph:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {title}
                    </div>
                </div>

                {/* ── NAVIGATION RUNES — THE TAB LIST, AND THE ONLY PART OF THE
                    RAIL ALLOWED TO GIVE WAY ────────────────────────────────────

                    This was a plain column: the tabs and the window controls were
                    laid out one after the other in a rail of fixed height, with
                    no scrolling and nothing allowed to shrink. The tabs were
                    simply unbounded, so once there were more of them than the
                    rail had room for, the overflow was clipped away by the
                    window's own `overflow-hidden` and nothing said so.

                    That is not a cosmetic cut. Empire OS declares ten tabs and
                    the Controls suite nine, and at the default window height the
                    rail runs out of room partway down the list — so the last tabs
                    could never be reached, and the minimise, maximise and close
                    buttons, which sit BELOW them in the same column, were pushed
                    clean off the bottom edge. A ten-tab window could not be
                    closed, and there was no way to see why.

                    The list now takes the flexible space and scrolls inside it,
                    so any number of tabs is reachable at any window height, and
                    the controls below keep their own size and stay pinned to the
                    foot of the rail where they belong. `min-h-0` is what makes
                    that work: a flex child will not shrink below its content
                    without it, and without it the list would push the controls
                    out exactly as before. */}
                <div className="flex flex-col gap-2 w-full px-2 flex-1 min-h-0 overflow-y-auto">
                    {/* Clicking a tab must never start a window drag — that was the
                        ghost event that threw panels across the screen. */}
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <Rune
                                icon={tab.icon}
                                active={currentTab === tab.id}
                                label={tab.label}
                            />
                        </div>
                    ))}
                </div>

                {/* Window Controls — pinned to the foot of the rail. `shrink-0`
                    is the whole point: these are the controls that get a window
                    out of the way, and they are the last thing that may ever be
                    pushed off the edge. */}
                <div className="window-rail-actions relative z-30 flex flex-col w-full" data-no-window-drag
                    onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}>
                    {/* Host callbacks bind existing services. Absence is unavailable,
                        never a fabricated successful BINS or Settings operation. */}
                    {(props.onOpenSettings || props.onOpenChat || props.onOpenBins) && (
                        <div className="window-utility-zone" role="group" aria-label={`${title} window utilities`}>
                            <button type="button" data-window-utility="bins" className="window-utility-button"
                                onClick={props.onOpenBins} disabled={typeof props.onOpenBins !== 'function'}
                                title={props.onOpenBins ? 'Open BINS library' : 'BINS: authorized library binding is not connected'}
                                aria-label={props.onOpenBins ? 'Open BINS library' : 'BINS library unavailable: not connected'}>
                                <Database className={CHROME_ICON.bar} aria-hidden="true" />
                            </button>
                            <button type="button" data-window-utility="chat" className="window-utility-button"
                                ref={props.chatButtonRef} onClick={props.onOpenChat} disabled={typeof props.onOpenChat !== 'function'}
                                aria-expanded={props.chatOpen === true} aria-controls={props.chatPanelId}
                                title="Open or restore @ibal" aria-label="Open or restore @ibal">
                                <Sparkles className={CHROME_ICON.bar} aria-hidden="true" />
                            </button>
                            <button type="button" data-window-utility="settings" className="window-utility-button"
                                onClick={props.onOpenSettings} disabled={typeof props.onOpenSettings !== 'function'}
                                title="Settings" aria-label={`Open ${title} settings`}>
                                <Settings className={CHROME_ICON.bar} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                    <div className="window-lifecycle-controls" role="group" aria-label={`${title} window controls`}>
                    {props.onPin && (
                        <button onClick={props.onPin} className="w-10 h-10 rounded-none hover:bg-foreground/[0.06] flex items-center justify-center text-muted-foreground hover:text-[hsl(var(--color-intent))] transition-colors" title="Pin to Desktop">
                            <Pin className={CHROME_ICON.bar} />
                        </button>
                    )}
                    <button onClick={onMinimize} className="w-10 h-10 rounded-none hover:bg-foreground/[0.06] flex items-center justify-center text-muted-foreground hover:text-white transition-colors" title="Minimize" aria-label="Minimize window">
                        <Minus className={CHROME_ICON.bar} />
                    </button>
                    <button onClick={toggleMaximize} className="w-10 h-10 rounded-none hover:bg-foreground/[0.06] flex items-center justify-center text-muted-foreground hover:text-white transition-colors" title={isMaximized ? "Restore" : "Maximize"} aria-label={isMaximized ? "Restore window" : "Maximize window"} disabled={isNativeFullscreen}>
                        {isMaximized ? <Minimize2 className={CHROME_ICON.bar} /> : <Maximize2 className={CHROME_ICON.bar} />}
                    </button>
                    <button onClick={onClose} className="w-10 h-10 rounded-none hover:bg-[hsl(var(--color-warning))]/15 flex items-center justify-center text-muted-foreground hover:text-[hsl(var(--color-warning))] transition-colors" title="Close" aria-label="Close window">
                        <X className={CHROME_ICON.bar} />
                    </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT SURFACE */}
            <div className="flex-1 relative flex flex-col">
                {/* TITLE BAR — the one place a window is dragged from, and it says so.
                    A drag region nobody can see is a drag region nobody can use.

                    It sits IN FLOW, at the standard 44px, so the window's chrome and
                    the panel's own header can never occupy the same band. It used to
                    be absolutely positioned over the glass, which reserved no height
                    at all — so every panel's own header rendered underneath it, and a
                    `pt-9` on the content was papering over the collision. The padding
                    is gone because the cause is gone.

                    Double-clicking it maximizes, the way a title bar does
                    everywhere else. */}
                <div
                    /* The identity probes. The title bar is where the desktop
                       projection of a pane's name is drawn, so it is where the
                       layout verification pass reads it — at every width, and
                       against what surfaceIdentity declared. */
                    data-xi-probe="identity"
                    data-xi-category={identity.category ?? ''}
                    data-xi-title={identity.title}
                    className={`h-11 w-full shrink-0 relative z-40 cursor-grab active:cursor-grabbing select-none flex items-center gap-2 px-4 pr-24 border-b border-border xi-grid ${hot ? 'xi-desktop-glass-hot' : 'xi-desktop-glass-chrome'}`}
                    /* The window's colour, carried on its title bar too. An
                       INSET SHADOW rather than a background: the bar's glass is
                       declared as a `background`, and an inline one would replace
                       it — this paints over the glass and underneath the text,
                       which is where a tint belongs. */
                    style={{ boxShadow: `inset 0 0 0 999px ${accentCss(theme, 0.12)}` }}
                    {...chromeDragProps}
                    onDoubleClick={maximizeFromChrome}
                >
                    <GripVertical className={cn(CHROME_ICON.bar, 'text-muted-foreground/70 shrink-0')} />
                    {Icon && <Icon className={cn(CHROME_ICON.bar, 'shrink-0')} style={{ color: accentCss(theme, 0.95) }} />}
                    {/* THE CATEGORY. The family this pane belongs to, carried
                        beside the title so the two are read together — which is
                        what makes "SAM LAW / Dockets" one pane rather than a
                        title that could belong to anything.
                        Absent is not drawn: a window opened on no declared
                        surface has no category, and inventing one for it is the
                        stew this exists to remove. */}
                    {identity.category && (
                        <span
                            className="shrink-0 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground border border-border"
                            title={`category · from the ${identity.category_source.toLowerCase()}`}
                        >
                            {identity.category}
                        </span>
                    )}
                    <span
                        data-xi-probe="text"
                        className="min-w-0 truncate text-[11px] font-medium tracking-wide text-foreground"
                    >
                        {identity.title}
                    </span>
                    <AttachedChips hostId={props.windowId} />
                    {titleBarActions && (
                        <div className="ml-auto shrink-0 flex items-center gap-2" data-no-window-drag
                            onPointerDown={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}>
                            {titleBarActions}
                        </div>
                    )}
                </div>
                
                {/* Standard App Menu Bar */}
                <div className="absolute top-2 right-2 z-50 pointer-events-auto">
                    <SystemFileBar 
                        appName={title}
                        surfaceRef={props.chatTarget?.id || `surface:${title}`}
                        workRef={props.chatTarget?.workRef || props.workRef || `surface:${title}`}
                        artifactRef={props.artifactRef || null}
                        onSettings={props.onOpenSettings}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                    />
                </div>

                {/* Content Container. The title bar above is in flow and reserves
                    its own height, so the content simply starts below it — no
                    compensating padding, and no collision to compensate for.

                    It carries its own surface, one step more solid than the frame
                    around it. The content used to sit directly on the frame's own
                    glass, so a form and the window behind it were the same value —
                    which is what made a card inside a window hard to read. The
                    surface is the theme's card colour, so it is near-black in the
                    dark shell and white under a light one, and it is deliberately
                    not quite opaque: enough desktop still shows through to place
                    the window in the field. */}
                {/* The reading surface carries the lattice. `xi-grid` is a
                    background-image, so it sits under everything the panel
                    renders — no content is ever covered by it, and no panel has
                    to know it is there. Its ink and cell come from the tokens in
                    index.css, so a window is ruled the same as every other. */}
                <div
                    /* The working artifact's side of the boundary, declared
                       rather than left to be inferred from a fill colour. */
                    data-glass-side={canvasGlass.side}
                    /* ── THE ARTICLES MEMBRANE, ON THE WINDOW ITSELF ─────────────
                     *
                     * This was an opaque rung of the luminance ladder, so a
                     * coloured window buried its own atmosphere under a solid
                     * slab — the working surface and the frame behind it read as
                     * one muddy plate, and the hue the window was lit by never
                     * reached the page. That is the stewy, hard-to-read state.
                     *
                     * `.xi-articles-glass` is the estate's own frosted working
                     * medium (see index.css) and it was declared for exactly
                     * this surface — but nothing ever wore it. One class here
                     * means every colour window resolves through one material
                     * instead of each inventing its own glass. */
                    data-article-layer={hot ? 'intent' : 'state'}
                    data-chat-open={Boolean(dock.open && dock.binding?.id === props.chatTarget?.id)}
                    data-chat-side={dock.side === 'left' ? 'left' : 'right'}
                    className="xi-window-work-area flex-1 min-h-0 overflow-hidden relative xi-grid flex xi-articles-glass"
                >
                    <div className="xi-window-primary flex-1 min-h-0 min-w-0 overflow-hidden relative">{children}</div>
                    {/* ── THE THREE SNAP POINTS ────────────────────────────────
                        Top, left and bottom, so a window can carry three
                        conversations at once — one about what it IS, one about
                        what it NEEDS, one about what it DID. The rules live in
                        src/lib/chatEdges.mjs; this is only where they are placed
                        and where the held lanes are released. */}
                    {props.chatTarget && (
                        <WindowChatLanes targetId={props.chatTarget.id} label={props.chatTarget.label} />
                    )}
                    {/* A chat snapped here anchors to THIS edge — the frame's
                        own border — and draws the seam that says so. See
                        ChatDockSlot: the seam lives on the dock because the
                        dock is the one thing all three hosts share, and a seam
                        written into each host would be three seams. */}
                    {props.chatTarget && <ChatDockSlot {...props.chatTarget} withinFrame />}
                </div>

                {/* Status Footer */}
                <div className={`h-8 border-t border-border xi-grid flex items-center px-4 justify-between text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest select-none ${hot ? 'xi-desktop-glass-hot' : 'xi-desktop-glass-chrome'}`}>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2">WINDOW OPEN</span>
                        <span>{props.footerStatus || 'RUNTIME: UNOBSERVED'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>{window.isSecureContext ? 'HTTPS CONTEXT' : 'INSECURE CONTEXT'}</span>
                        {/* Settings is in the persistent left utility zone, not this status footer. */}
                    </div>
                </div>
            </div>

            {/* ── THE GLASS BOUNDARY, DRAWN ──────────────────────────────────
                The frame is the boundary a person looks at the work THROUGH, so
                it is the glass side — and it is declared as such rather than
                merely styled as such. The edge reads the mode's own glass token,
                so it is a light edge on the dark shell and a dark edge on the
                light one: one material, lit from whichever side the shell is.

                A ring, not a fill. The frame's own surface stays on the
                luminance ladder, so the step from frame to canvas — the thing
                that makes a window's content readable on its own chrome — is
                untouched. Glass here is a boundary, and a boundary is an edge. */}
            <div
                data-glass-side="GLASS"
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30 ring-1 ring-inset ring-[hsl(var(--glass-edge))]/10"
            />

            {/* ── THE FIRE OVER THE WORK IS OUT ────────────────────────────────
                A pointer-tracked radial fire was re-lit ON TOP of the glass at
                z-30 and blended with `screen`, so it lay across the working
                artifact — the window's whole body, every card and every line of
                text inside it. It was drawn as light, and what it did to the
                ink was the opposite: a low-opacity wash competing with the
                glyphs standing on it, which is the "really hard to read" the
                content areas were reported as.

                The window still has a light — the desktop's own atmosphere
                behind the glass — and it still has depth, which is now carried
                by a crisp drop shadow on the frame. What is gone is the second
                light painted over the work. A surface you read on does not get
                to have a glow lying across it. */}

            {/* ── THE RESTING WEIGHT, WHICH IS NOT A FOCUS STATE ──────────────
             *
             * This was drawn only on the UNFOCUSED window, so focus read as
             * "this window is brighter" — and the window you were working in was
             * the washed-out one. The resting weight is now the resting weight:
             * every window carries it, focused or not, and focus is stated by the
             * edge and the fire alone.
             *
             * It lifts for the hot state, because a window that is about to
             * receive a conversation is not resting, and the drop label it shows
             * has to be read. */}

        </motion.div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover backdrop-blur-xl border-border text-popover-foreground">
            <ContextMenuItem onSelect={onFocus}>
                <Layers className="w-4 h-4 mr-2" /> Bring to Front
            </ContextMenuItem>
            <ContextMenuItem onSelect={onMinimize}>
                <Minus className="w-4 h-4 mr-2" /> Minimize
            </ContextMenuItem>
            <ContextMenuItem onSelect={toggleMaximize} disabled={isNativeFullscreen}>
                {isMaximized
                    ? <Minimize2 className="w-4 h-4 mr-2" />
                    : <Maximize2 className="w-4 h-4 mr-2" />}
                {isMaximized ? 'Restore Down' : 'Maximize'}
            </ContextMenuItem>
            {props.onPin && (
                <ContextMenuItem onSelect={props.onPin}>
                    <Pin className="w-4 h-4 mr-2" /> Pin to Desktop
                </ContextMenuItem>
            )}
            <ContextMenuSeparator className="bg-border" />
            <ContextMenuItem onSelect={onClose} className="text-[hsl(var(--color-warning))] focus:text-[hsl(var(--color-warning))]">
                <X className="w-4 h-4 mr-2" /> Close Window
            </ContextMenuItem>
        </ContextMenuContent>
        </ContextMenu>
    );
}
