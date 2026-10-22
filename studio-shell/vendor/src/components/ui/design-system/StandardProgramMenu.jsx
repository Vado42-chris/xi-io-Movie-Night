import React from 'react';
import { 
    Menu, 
    MoreHorizontal, 
    Save, 
    SaveAll,
    FilePlus2,
    FolderOpen, 
    Settings, 
    HelpCircle, 
    LogOut,
    Printer,
    Share2,
    Command,
    ChevronRight,
    Search,
    Undo,
    Redo,
    Maximize,
    Minimize
} from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuShortcut
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { FILE_ACTION, dispatchFileAction, rankSaveTargets } from '@/lib/fileMenuContract.mjs';

/**
 * STANDARD XIBALBA PROGRAM MENU
 * 
 * Provides a consistent "Hamburger" or "Context" menu for all Xibalba apps.
 * 
 * Composition:
 * 1. System Context (App Identity, Version)
 * 2. File Operations (Save, Open, Export)
 * 3. Edit Operations (Undo/Redo - often context specific)
 * 4. View Operations (Zoom, Theme, Layout)
 * 5. App-Specific Actions (Injected via props)
 * 6. Help & System (Docs, Shortcuts, About)
 */
export default function StandardProgramMenu({ 
    appName = "Application", 
    appVersion = "1.0.0",
    onNew,
    onSave,
    onSaveAs,
    onOpen,
    onExport,
    onShare,
    onSettings,
    surfaceRef,
    workRef,
    artifactRef = null,
    saveTargets = [],
    saveGuidelines = {},
    whiteLabel = false,
    fileStatus = null,
    customItems = [],
    className
}) {
    const context = { surface_ref: surfaceRef || `surface:${appName}`, work_ref: workRef, artifact_ref: artifactRef };
    const run = (action, callback, extra = {}) => {
        if (typeof callback !== 'function') return;
        const envelope = dispatchFileAction(action, { ...context, ...extra });
        callback?.(envelope);
    };
    const rankedTargets = rankSaveTargets(saveTargets, saveGuidelines);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon"
                    aria-label={`File menu for ${appName}`}
                    title="File menu" 
                    className={cn("h-11 w-11 md:h-8 md:w-8 data-[state=open]:bg-white/10", className)}
                >
                    <Menu className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} collisionPadding={8}
                className={cn('w-[min(22rem,calc(100vw-1rem))] max-h-[min(42rem,calc(100dvh-1rem))] overflow-y-auto bg-black/95 border-white/10 text-neutral-200 backdrop-blur-xl', whiteLabel && 'xi-white-label')}>
                
                {/* IDENTITY SECTION */}
                <div className="px-2 py-1.5 text-[10px] font-mono text-neutral-500 flex justify-between uppercase tracking-wider border-b border-white/5 mb-1">
                    <span>{appName}</span>
                    <span>v{appVersion}</span>
                </div>

                {/* PRIMARY ACTIONS */}
                <DropdownMenuLabel>File</DropdownMenuLabel>
                {fileStatus && <div className="px-2 pb-2 text-[10px] text-neutral-400" role="status">{fileStatus}</div>}
                <DropdownMenuItem disabled={!onNew} onClick={() => run(FILE_ACTION.NEW, onNew)}>
                    <FilePlus2 className="mr-2 h-3.5 w-3.5" />
                    <span>New</span>
                    <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!onOpen} onClick={() => run(FILE_ACTION.OPEN, onOpen)}>
                    <FolderOpen className="mr-2 h-3.5 w-3.5" />
                    <span>Open...</span>
                    <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!onSave} onClick={() => run(FILE_ACTION.SAVE, onSave)}>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    <span>Save</span>
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <SaveAll className="mr-2 h-3.5 w-3.5" />
                        <span>Save As...</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-[min(18rem,calc(100vw-1rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-black/90 border-white/10 text-neutral-200">
                        {rankedTargets.length === 0 ? (
                            <DropdownMenuItem disabled={!onSaveAs} onClick={() => run(FILE_ACTION.SAVE_AS, onSaveAs)}>
                                Choose destination...
                            </DropdownMenuItem>
                        ) : rankedTargets.map((target) => (
                            <DropdownMenuItem
                                disabled={!onSaveAs}
                                key={target.id || `${target.provider}:${target.path || target.name}`}
                                onClick={() => run(FILE_ACTION.SAVE_AS, onSaveAs, { target })}
                            >
                                <span className="min-w-0 flex-1 truncate">{target.label || target.name || target.path || target.provider}</span>
                                <span className={cn('ml-2 text-[9px] font-mono', target.storage_class === 'UNKNOWN' ? 'text-amber-400' : 'text-neutral-500')}>{target.storage_class}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Share2 className="mr-2 h-3.5 w-3.5" />
                        <span>Export / Share</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-black/90 border-white/10 text-neutral-200">
                        <DropdownMenuItem disabled={!onExport} onClick={() => run(FILE_ACTION.EXPORT, onExport, { format: 'native' })}>Export native artifact</DropdownMenuItem>
                        <DropdownMenuItem disabled={!onExport} onClick={() => run(FILE_ACTION.EXPORT, onExport, { format: 'json' })}>Export JSON</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem disabled={!onShare} onClick={() => run(FILE_ACTION.SHARE, onShare)}>Share Link...</DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator className="bg-white/10" />

                {/* EDIT ACTIONS */}
                <DropdownMenuLabel className="hidden md:block">Edit</DropdownMenuLabel>
                <DropdownMenuItem className="hidden md:flex">
                    <Undo className="mr-2 h-3.5 w-3.5" />
                    <span>Undo</span>
                    <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem className="hidden md:flex">
                    <Redo className="mr-2 h-3.5 w-3.5" />
                    <span>Redo</span>
                    <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
                </DropdownMenuItem>

                {/* DYNAMIC APP SPECIFIC ITEMS */}
                {customItems.length > 0 && (
                    <>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuLabel>App Actions</DropdownMenuLabel>
                        {customItems.map((item, idx) => (
                            <DropdownMenuItem key={idx} onClick={item.action} disabled={item.disabled}>
                                {item.icon && <item.icon className="mr-2 h-3.5 w-3.5" />}
                                <span>{item.label}</span>
                                {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}

                <DropdownMenuSeparator className="bg-white/10" />

                {/* VIEW & WINDOW */}
                <DropdownMenuLabel className="hidden md:block">Window</DropdownMenuLabel>
                <DropdownMenuItem className="hidden md:flex">
                    <Maximize className="mr-2 h-3.5 w-3.5" />
                    <span>Toggle Fullscreen</span>
                    <DropdownMenuShortcut>F11</DropdownMenuShortcut>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="bg-white/10" />
                
                {/* SYSTEM & HELP */}
                <DropdownMenuItem disabled={!onSettings} onClick={onSettings}>
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    <span>Preferences</span>
                    <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <HelpCircle className="mr-2 h-3.5 w-3.5" />
                    <span>Documentation</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Command className="mr-2 h-3.5 w-3.5" />
                    <span>Keyboard Shortcuts</span>
                </DropdownMenuItem>

            </DropdownMenuContent>
        </DropdownMenu>
    );
}