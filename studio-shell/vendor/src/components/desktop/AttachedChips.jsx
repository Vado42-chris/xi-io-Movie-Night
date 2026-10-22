import React from 'react';
import { Link2 } from 'lucide-react';
import { useGrid } from './DesktopGridSystem';
import { attachedTo } from '@/lib/attachedPanes.mjs';

/* The tools attached to this window, drawn in its own header.
 *
 * Read from the widgets' own `docked_to` record, so a chip appears the moment a
 * widget is dropped flush against the window and disappears the moment it is
 * dragged away. Pressing a chip brings that widget forward — it does not
 * detach it. Absent when nothing is attached: no placeholder is drawn. */
export default function AttachedChips({ hostId }) {
    const { widgets, raiseSurface } = useGrid();
    const attached = attachedTo(hostId, widgets);
    if (!attached.length) return null;

    return (
        <div
            className="ml-auto flex shrink-0 items-center gap-1"
            data-attached-count={attached.length}
            /* The header is a drag handle; a press on a chip is not a drag. */
            onPointerDown={(e) => e.stopPropagation()}
        >
            {attached.map((tool) => (
                <button
                    key={tool.id}
                    type="button"
                    onClick={() => raiseSurface(tool.id)}
                    title={`${tool.name} is attached${tool.edge ? ` on its ${tool.edge} edge` : ''} — moves with this window`}
                    className="flex items-center gap-1 border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-[hsl(var(--color-intent))] hover:text-[hsl(var(--color-intent))]"
                >
                    <Link2 className="h-2.5 w-2.5" />
                    {tool.name}
                </button>
            ))}
        </div>
    );
}