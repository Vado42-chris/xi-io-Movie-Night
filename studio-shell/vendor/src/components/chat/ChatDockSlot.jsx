import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerChatTarget, useChatDock, snapChat, setChatDragging } from '@/lib/chatDockStore';
import { useWhiteLabel } from '@/lib/whiteLabelStore';
import { compileWindowFormation } from '@/lib/windowFormation.mjs';
import { useDeviceShape } from '@/hooks/use-device-shape';
import { DEVICE } from '@/lib/chatSnap.mjs';

/* `fill` is for a slot inside a small panel (an assistant sidebar) that has no
   room beside its content: the docked conversation takes the whole panel, and
   Undock gives the panel back. Without it the slot is a column at the edge. */
export default function ChatDockSlot({ id, label, workRef, category = 'Work surface', coordinate = null, fill = false, withinFrame = false }) {
  const ref = useRef(null); const dock = useChatDock();
  const whiteLabel = useWhiteLabel();
  const device = useDeviceShape();
  useEffect(() => registerChatTarget({ id, label, workRef, category, coordinate, element: ref.current }), [id, label, workRef, category, coordinate]);
  const bound = dock.open && dock.binding?.id === id;
  const offered = Boolean(dock.dragging) && !bound;
  /* Which edge the snapped conversation takes. The slot is already a flex child
     of the surface it is docked to, so the side is the ORDER and the border
     rather than a second placement — one declaration, and the seam below reads
     the same value so the line and the dock can never disagree about which edge
     they are on.
     Below lg the host is a column, so the side is not drawn at all: a phone
     stacks the conversation, and an `order` there would move it above the work
     rather than beside it. */
  const side = dock.side === 'left' ? 'left' : 'right';
  const formation = compileWindowFormation({
    root_ref: dock.environment?.root_ref || dock.binding?.root_ref || null,
    base_ref: dock.environment?.base_ref || dock.binding?.base_ref || null,
    home_ref: dock.environment?.home_ref || dock.binding?.home_ref || null,
    target_ref: bound ? id : dock.protocol?.target_ref,
    work_ref: workRef || dock.protocol?.work_ref,
    conversation_ref: dock.conversationRef,
    generation: dock.generation,
    crew: dock.protocol?.crew || [],
    requested_principals: dock.requestedPrincipals || [],
    principals: dock.principals || [],
  });
  const acceptDrop = (event) => {
    const ref = event.dataTransfer.getData('application/x-xiio-chat');
    if (!ref || ref !== dock.conversationRef) return;
    event.preventDefault();
    snapChat(id);
    setChatDragging(false);
  };

  /* Mobile registers the SAME target identity but does not render a second chat
   * projection. MobileLeftRail is the sole visual chat owner below 1024px. */
  if (!withinFrame && device !== DEVICE.DESKTOP) {
    return <span ref={ref} hidden data-chat-drop-target={id} data-chat-registration-only="narrow" />;
  }

  /* The knockout sits on the DOCK, not only on the shell inside it.
   *
   * The shell covers the transcript and the composer. The dock's own chrome —
   * its edge, and whatever a target contributes to it — is outside that, so a
   * knockout applied to the shell alone left the dock's frame carrying the
   * brand while the reading said the surface was clear. One surface, one
   * knockout, applied where the surface actually begins. */
  return (
    <aside
      ref={ref}
      aria-label={`Conversation dock for ${label}`}
      data-chat-drop-target={id}
      data-window-formation={formation.formation_ref}
      data-window-formation-scale={formation.scale}
      data-window-formation-state={formation.state}
      data-command-ref={dock.environment?.command_ref || 'COMDCCT'}
      data-window-quorum={formation.quorum.state}
      data-window-crew-size={formation.crew_size}
      data-window-principal-count={formation.admitted_count}
      onDragOver={(event) => { if (offered) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={acceptDrop}
      className={bound
        ? `${fill
            ? 'xi-chat-dock xi-chat-dock-fill'
            : `xi-chat-dock relative border-[hsl(var(--glass-edge))]/15 ${side === 'left' ? 'border-r order-first' : 'border-l'}`} min-h-0 min-w-0 flex flex-col${whiteLabel ? ' xi-white-label' : ''}`
        : offered
          ? `xi-chat-drop-target${whiteLabel ? ' xi-white-label' : ''}`
          : 'hidden'}
    >
      {/* ── THE SEAM — WHERE THE CONVERSATION WAS SNAPPED ON ────────────────
       *
       * A chat flush against a frame is a coincidence of pixels until something
       * says the two agreed. This is that agreement, drawn: a single edge line
       * on the dock's own left border, which IS the frame's border, in the
       * mode's glass token — so the seam reads as the boundary it is rather
       * than as a divider somebody liked.
       *
       * It lives HERE, on the dock, and not in each host. The dock is the one
       * thing the window frame, the pinned window and the shell all share, so a
       * seam written into each host would be three seams that drift — and the
       * third one would be the one nobody remembered to update.
       *
       * `fill` is excluded: a fill slot takes the whole panel it was given and
       * has no frame edge to be anchored to, so a seam there would be a line
       * drawn against nothing. */}
      {bound && !fill && (
        <span
          data-chat-seam="SNAPPED"
          data-chat-seam-target={id}
          aria-hidden
          className={`pointer-events-none absolute top-0 bottom-0 w-px z-widget bg-[hsl(var(--glass-edge))]/30 ${side === 'left' ? 'right-0' : 'left-0'}`}
        />
      )}
      {bound && !fill && (
        <span
          className="pointer-events-none absolute bottom-1 right-1 z-widget px-1 py-[1px] font-mono text-[8px] uppercase tracking-wider text-neutral-500"
          title={formation.first_red || `${formation.quorum.equation} · ${formation.formation_ref}`}
        >
          5s · {formation.state === 'QUORUM' ? 'QUORUM' : formation.state}
        </span>
      )}
      {offered && <span className="xi-chat-drop-label">Snap chat to {label}</span>}
    </aside>
  );
}

/** Keep one existing conversation instance while its presentation moves.
 * This owns DOM placement and focus only, never draft storage, Work or authority.
 * Native cross-window undocking requires the existing host lifecycle separately.
 */
export function PersistentChatPortal({ children, panelId, target, fallbackRef, parkingRef, open, focusOnOpenRef, composerSelector }) {
  const [container] = useState(() => {
    const node = document.createElement('div');
    node.id = panelId;
    node.className = 'xi-chat-session';
    return node;
  });
  useLayoutEffect(() => {
    const destination = open ? (target || fallbackRef.current) : parkingRef.current;
    if (!destination) return;
    const focused = container.contains(document.activeElement) ? document.activeElement : null;
    // Passing a new portal target would remount its React children. Move this
    // stable DOM container instead, retaining state and any pending operation.
    if (container.parentNode !== destination) destination.appendChild(container);
    container.hidden = !open;
    if (open && focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      container.querySelector(composerSelector)?.focus({ preventScroll: true });
    } else if (open && focused?.isConnected) focused.focus({ preventScroll: true });
  }, [container, target, open, fallbackRef, parkingRef, focusOnOpenRef, composerSelector]);
  useLayoutEffect(() => () => container.remove(), [container]);
  return createPortal(children, container, panelId);
}
