import React from 'react';
import { useChatAttachments } from '@/lib/chatAttachments';
import { laneQuorum } from '@/lib/chatEdges.mjs';
import { useChatDock, snapChatToEdge, releaseLane, setChatDragging } from '@/lib/chatDockStore';
import { cn } from '@/lib/utils';

/* ── THE THREE SNAP POINTS ON A WINDOW ───────────────────────────────────────
 *
 * A window carries three conversations, one per edge, and this is where they are
 * placed. The rules — which three edges, what each is for, and why the address
 * carries the edge — live in src/lib/chatEdges.mjs and are read from there rather
 * than restated here.
 *
 * ── WHY THE ZONES ARE NOT ALWAYS DRAWN ──────────────────────────────────────
 *
 * Three dashed bands permanently over the working artifact would be furniture
 * lying across the thing a person is reading, and the artifact is PAPER — the
 * estate's own rule is that nothing decorative goes over the work. So the snap
 * points appear at the one moment they mean something (a conversation is being
 * dragged) and are absent the rest of the time.
 *
 * What does NOT disappear is the state: an occupied lane keeps a chip, because a
 * window that has silently acquired a conversation has acquired something its
 * owner cannot see and cannot let go.
 */
const ZONE = {
  TOP: 'inset-x-0 top-0 h-10',
  LEFT: 'inset-y-0 left-0 w-14',
  BOTTOM: 'inset-x-0 bottom-0 h-10',
};

export default function WindowChatLanes({ targetId, label }) {
  const records = useChatAttachments();
  const dock = useChatDock();

  if (!targetId) return null;

  const { lanes, occupied, quorum } = laneQuorum(records, targetId);
  const dragging = Boolean(dock.dragging);

  if (!dragging && !occupied) return null;

  const accept = (event, edge) => {
    event.preventDefault();
    event.stopPropagation();
    const ref = event.dataTransfer.getData('application/x-xiio-chat');
    if (!ref || ref !== dock.conversationRef) return;
    try {
      snapChatToEdge(targetId, edge);
    } catch {
      /* Refused by name inside the store — an occupied edge, or a conversation
         already leading another lane of this window. The lane simply stays as it
         was, which is the honest outcome: nothing was taken. */
    }
    setChatDragging(false);
  };

  return (
    <>
      {/* ── THE SNAP POINTS, WHILE A CONVERSATION IS IN THE HAND ─────────────
          Each says whether it is free before it is used, so the refusal is
          visible on approach rather than after the drop. */}
      {dragging && lanes.map((lane) => (
        <div
          key={lane.edge}
          data-chat-lane={lane.edge}
          data-chat-lane-state={lane.state}
          title={lane.meaning}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => accept(event, lane.edge)}
          className={cn(
            'absolute z-widget flex items-center justify-center font-mono text-[9px] uppercase tracking-widest',
            ZONE[lane.edge],
            lane.state === 'OCCUPIED'
              ? 'border border-[hsl(var(--color-intent))]/25 bg-background/70 text-neutral-500'
              : 'border border-dashed border-[hsl(var(--color-intent))]/45 bg-[hsl(var(--color-intent))]/[.07] text-[hsl(var(--color-intent))]',
          )}
        >
          {lane.state === 'OCCUPIED' ? `${lane.trinity} · held` : lane.trinity}
        </div>
      ))}

      {/* ── WHAT IS HELD, AND THE WAY OUT ────────────────────────────────────
          One chip per occupied lane, in one place, so the window's lane state is
          readable at a glance and every lane can be let go. `quorum` is stated on
          the row rather than per chip: a lane is occupied or it is not, and the
          interesting number is how many of the three are held. */}
      {!dragging && occupied > 0 && (
        <div
          data-chat-lanes={targetId}
          data-chat-lane-quorum={quorum}
          className="absolute right-1 top-1 z-widget flex items-center gap-1"
        >
          {lanes.filter((lane) => lane.state === 'OCCUPIED').map((lane) => (
            <button
              key={lane.edge}
              type="button"
              onClick={() => releaseLane(targetId, lane.edge)}
              title={`${lane.meaning}\n\n${lane.label || lane.conversation_ref}\n\nPress to release this lane.`}
              aria-label={`Release the ${lane.trinity} conversation from ${label || 'this window'}`}
              className="border border-[hsl(var(--color-intent))]/40 bg-background/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-[hsl(var(--color-intent))] transition-colors hover:bg-[hsl(var(--color-intent))]/15"
            >
              {lane.trinity}
            </button>
          ))}
        </div>
      )}
    </>
  );
}