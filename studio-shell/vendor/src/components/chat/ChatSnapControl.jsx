import React from 'react';
import { useChatDock, snapChat, detachChat, adoptChild, releaseChild, setChatDragging, setChatSide } from '@/lib/chatDockStore';

/* Where this conversation lives, and who works under it.
 *
 * Docking changes context, never the thread and never its authority. The surface
 * this conversation is docked to is its LEAD; a surface adopted under it is its
 * CREW, and the lead governs it. A surface that is neither is UNRELATED — two
 * windows that happen to sit near each other are not a crew, so nothing is ever
 * adopted on the owner's behalf. A crew is chosen, or there is no crew.
 *
 * The crew is the same crew on every device; only its SHAPE differs, and that is
 * `projectionForDevice`'s answer rather than this control's. On a phone the lead
 * is the face and the crew sits behind it, one at a time. This only says who is
 * in it.
 */
export default function ChatSnapControl() {
  const dock = useChatDock();
  const lead = dock.protocol?.target_ref || null;
  const crew = dock.protocol?.crew || [];
  const others = dock.targets.filter(t => t.id !== lead);
  const beginDrag = (event) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-xiio-chat', dock.conversationRef);
    event.dataTransfer.setData('text/plain', dock.conversationRef);
    setChatDragging(true);
  };
  const endDrag = () => setChatDragging(false);
  return <>
    <button
      type="button"
      draggable
      onDragStart={beginDrag}
      onDragEnd={endDrag}
      className="cursor-grab active:cursor-grabbing border border-border px-2 py-1 text-xs"
      title="Drag this conversation onto any glowing work surface"
      aria-label="Drag conversation to a work surface"
    >
      Drag chat
    </button>
    <select
      aria-label="Dock this conversation to a work surface"
      className="max-w-[14rem] bg-transparent border border-border px-2 py-1 text-xs"
      value={dock.binding?.id || ''}
      onChange={e => (e.target.value ? snapChat(e.target.value) : detachChat())}
    >
      <option value="">Everyday, unattached</option>
      {dock.binding && !dock.targets.some(t => t.id === dock.binding.id) && (
        <option value={dock.binding.id}>Attached to {dock.binding.label}, window closed</option>
      )}
      {dock.targets.map(t => <option key={t.id} value={t.id}>Dock to {t.label}</option>)}
    </select>
    {dock.binding && (
      <>
        <span
          className="text-[10px] font-mono text-neutral-500"
          title="This conversation leads the surface it is docked to. The crew are the surfaces adopted under it."
        >
          {crew.length ? `LEAD + ${crew.length}` : 'LEAD'}
        </span>
        {others.map(t => {
          const adopted = crew.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={adopted
                ? 'text-xs border border-border px-2 py-0.5 text-foreground'
                : 'text-xs border border-border px-2 py-0.5 text-neutral-500 hover:text-foreground'}
              title={adopted ? `Release ${t.label} from this crew` : `Put ${t.label} under this lead`}
              onClick={() => (adopted ? releaseChild(t.id) : adoptChild(t.id))}
            >
              {adopted ? '●' : '○'} {t.label}
            </button>
          );
        })}
        {/* The snap puts the conversation on the right edge. This is the choice
            the owner makes after that, and it belongs here, on the dock's own
            control row — the dock's tools stay on the right of the dock whatever
            edge the dock itself takes. */}
        <button
          type="button"
          className="text-xs border border-border px-2 py-0.5 text-neutral-500 hover:text-foreground"
          title="Which edge of the surface this conversation sits on. The surface's own tools stay on the right."
          onClick={() => setChatSide(dock.side === 'left' ? 'right' : 'left')}
        >
          Chat on {dock.side === 'left' ? 'left' : 'right'}
        </button>
        <button type="button" className="text-xs underline" onClick={detachChat}>Undock</button>
      </>
    )}
  </>;
}