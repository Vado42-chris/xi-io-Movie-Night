import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Film, Sparkles, Maximize2 } from 'lucide-react';
import { Toaster } from 'sonner';
import WindowFrame from '@/components/desktop/WindowFrame';
import { PersistentChatPortal } from '@/components/chat/ChatDockSlot';
import { GridProvider } from '@/components/desktop/DesktopGridSystem';
import { SnapGuideProvider } from '@/lib/snapGuide';
import { useChatDock, setChatOpen, snapChat, setChatSide, setChatView } from '@/lib/chatDockStore';
import Concierge from './Concierge';
import MovieSettings, { useMovieSettings } from './Settings';
import PhoneRemote from './PhoneRemote';
import '../vendor/src/index.css';
import './style.css';
import './settings.css';

const TARGET = Object.freeze({ id: 'personal:movie-night', label: 'Movie Night', workRef: 'personal:movie-night', category: 'Entertainment' });
const WALL_COMMANDS = new Set(['prepare_movie_player', 'show_movie_player', 'show_movie_wall', 'toggle_movie_fullscreen', 'set_movie_controls_height', 'set_movie_viewport']);
const COMMANDS = new Set([...WALL_COMMANDS, 'native_movie_window']);
const GEOMETRY = 'movie-night.studio.geometry/v1';
function openingGeometry() {
  const width = Math.max(400, Math.min(1180, innerWidth - 32));
  const height = Math.max(340, Math.min(900, innerHeight - 160));
  try {
    const old = JSON.parse(localStorage.getItem(GEOMETRY) || 'null');
    if (old?.size?.width >= 400 && old?.size?.height >= 300) return {
      size: { width: Math.min(old.size.width, width), height: Math.min(old.size.height, height) },
      position: { x: Math.max(0, Math.min(Number(old.position?.x) || 16, innerWidth - width)), y: Math.max(0, Math.min(Number(old.position?.y) || 16, 40)) },
    };
  } catch { /* A malformed previous layout never prevents opening. */ }
  return { size: { width, height }, position: { x: Math.max(0, Math.min(32, (innerWidth - width) / 2)), y: 16 } };
}
function tauriInvoke(command, args) {
  if (!COMMANDS.has(command)) return Promise.reject(new Error('Unsupported Movie Night window command.'));
  const binding = [window.__TAURI__?.core, window.__TAURI_INTERNALS__].find(x => typeof x?.invoke === 'function');
  return binding ? binding.invoke(command, args) : Promise.reject(new Error('This view is not in the native Movie Night window.'));
}

function StudioMovieNight() {
  const settingsStore = useMovieSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsContext, setSettingsContext] = useState('browsing');
  const wallContext = useRef('browsing');
  const [appearancePreview, setAppearancePreview] = useState(null);
  const settingsRef = useRef(settingsStore.record.settings);
  const stage = useRef(null);
  const wall = useRef(null);
  const initial = useRef(openingGeometry());
  const bridgeState = useRef({ active: false, fullscreen: false, visible: true, floatingChat: false });
  const [paneVisible, setPaneVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeActive, setNativeActive] = useState(false);
  const [chatMount, setChatMount] = useState(null);
  const chatParking = useRef(null);
  const chatFallback = useRef(null);
  const chatButton = useRef(null);
  const focusChatOnOpen = useRef(false);
  const [selection, setSelection] = useState(null);
  const [hostError, setHostError] = useState('');
  const [nativeWindowState, setNativeWindowState] = useState(() => window.__MOVIE_NIGHT_WINDOW_STATE__ || { maximized: false, fullscreen: false, focused: true });
  const dock = useChatDock();
  const native = window.__MOVIE_NIGHT_NATIVE__ === true;
  const appearance = appearancePreview || settingsStore.record.settings.appearance;
  const glass = native && nativeWindowState.transparency?.available === true && appearance.mode === 'glass';
  const materialRef = useRef({ glass: false, opacity: 82 });
  settingsRef.current = settingsStore.record.settings;
  materialRef.current = { glass, opacity: appearance.opacity };

  bridgeState.current.visible = paneVisible;
  bridgeState.current.floatingChat = settingsOpen || Boolean(dock.open && !chatMount);
  useEffect(() => {
    const slot = dock.open && dock.binding?.id === TARGET.id
      ? stage.current?.querySelector(`aside[data-chat-drop-target="${TARGET.id}"]`) : null;
    setChatMount(slot);
  }, [dock.open, dock.binding?.id, dock.side, paneVisible]);

  function applyAppearance() {
    const material = materialRef.current;
    for (const documentRoot of [document.documentElement, wall.current?.contentDocument?.documentElement]) {
      if (!documentRoot) continue;
      documentRoot.dataset.windowMaterial = material.glass ? 'glass' : 'solid';
      documentRoot.style.setProperty('--movie-night-surface-opacity', String(material.opacity / 100));
    }
  }
  useEffect(() => { applyAppearance(); }, [glass, appearance.opacity]);
  useEffect(() => {
    wall.current?.contentWindow?.movieNightSettings?.(settingsStore.record.settings);
    window.dispatchEvent(new CustomEvent('movie-night:settings-changed', { detail: settingsStore.record.settings }));
  }, [settingsStore.record]);
  useEffect(() => {
    const receive = event => {
      if (event.origin !== location.origin || event.source !== wall.current?.contentWindow || event.data?.type !== 'movie-night:context') return;
      if (['browsing', 'playback'].includes(event.data.view)) wallContext.current = event.data.view;
      const value = event.data.selection;
      if (value && Array.isArray(value.ids) && value.ids.length <= 1000 && value.ids.every(id => typeof id === 'string' && /^(movie|series):tt\d{5,12}$/.test(id))) setSelection(value);
    };
    addEventListener('message', receive);
    return () => removeEventListener('message', receive);
  }, []);

  function forwardMode(active) {
    bridgeState.current.active = active === true;
    setNativeActive(active === true);
    wall.current?.contentWindow?.movieNightNativeMode?.(active === true);
  }
  function forwardFullscreen(active) {
    bridgeState.current.fullscreen = active === true;
    setFullscreen(active === true);
    wall.current?.contentWindow?.movieNightNativeFullscreen?.(active === true);
  }
  async function bridgeInvoke(command, args) {
    if (!WALL_COMMANDS.has(command)) throw new Error('Unsupported movie playback window command.');
    const result = await tauriInvoke(command, args);
    if (command === 'show_movie_player' && result === true) forwardMode(true);
    if (command === 'show_movie_wall') forwardMode(false);
    if (command === 'toggle_movie_fullscreen' && typeof result === 'boolean') forwardFullscreen(result);
    return result;
  }
  function receiveWindowState(value) {
    if (!value || typeof value.maximized !== 'boolean' || typeof value.fullscreen !== 'boolean') return;
    // The operating system owns these states, including changes made through
    // desktop shortcuts. DOM geometry is never used to infer native state.
    setNativeWindowState(previous => previous.maximized === value.maximized && previous.fullscreen === value.fullscreen && previous.focused === value.focused && JSON.stringify(previous.transparency) === JSON.stringify(value.transparency) ? previous : value);
    if (bridgeState.current.fullscreen !== value.fullscreen) forwardFullscreen(value.fullscreen);
  }
  async function nativeWindowAction(action, direction) {
    try {
      const result = await tauriInvoke('native_movie_window', { action, ...(direction ? { direction } : {}) });
      receiveWindowState(result);
    } catch {
      setHostError(`The window could not ${action === 'maximize' ? 'change size' : action}.`);
    }
  }
  function connectWall() {
    const child = wall.current?.contentWindow;
    if (!child || child.location.origin !== location.origin) return;
    child.__MOVIE_NIGHT_NATIVE__ = native;
    child.__MOVIE_NIGHT_SHELL__ = Object.freeze({ invoke: bridgeInvoke });
    child.movieNightNativeMode?.(bridgeState.current.active);
    child.movieNightNativeFullscreen?.(bridgeState.current.fullscreen);
    child.movieNightSettings?.(settingsRef.current);
    applyAppearance();
  }

  useEffect(() => {
    window.movieNightNativeMode = forwardMode;
    window.movieNightVideoInteraction = () => wall.current?.contentWindow?.movieNightVideoInteraction?.();
    window.movieNightNativeFullscreen = forwardFullscreen;
    window.movieNightNativeWindowState = receiveWindowState;
    document.documentElement.classList.toggle('movie-night-native-shell', native);
    if (native) nativeWindowAction('state');
    connectWall();
    const leaveFullscreen = (event) => {
      // The outer fullscreen button owns focus after it is clicked. The wall's
      // iframe keyboard handler cannot receive that outer-document Escape.
      if (native && event.key === 'Escape' && bridgeState.current.fullscreen && !event.defaultPrevented && !document.querySelector('#movie-settings[open]')) {
        event.preventDefault();
        bridgeInvoke('toggle_movie_fullscreen').catch(() => setHostError('Full screen could not be changed.'));
      }
    };
    addEventListener('keydown', leaveFullscreen);
    let frame, pending = false, sent = '', failed = false;
    const publishViewport = () => {
      frame = requestAnimationFrame(publishViewport);
      if (!native || failed || pending) return;
      const iframe = wall.current;
      const state = bridgeState.current;
      const placeholder = iframe?.contentDocument?.getElementById('native-video-placeholder');
      const outer = iframe?.getBoundingClientRect();
      const inside = placeholder?.getBoundingClientRect();
      const scaleX = outer && iframe.clientWidth ? outer.width / iframe.clientWidth : 1;
      const scaleY = outer && iframe.clientHeight ? outer.height / iframe.clientHeight : 1;
      const visible = Boolean(state.active && state.visible && !state.floatingChat && inside && inside.width > 1 && inside.height > 1 && !document.hidden);
      const rect = visible ? {
        x: outer.left + inside.left * scaleX, y: outer.top + inside.top * scaleY,
        width: inside.width * scaleX, height: inside.height * scaleY, visible: true,
      } : { x: 0, y: 0, width: 0, height: 0, visible: false };
      for (const key of ['x', 'y', 'width', 'height']) rect[key] = Math.round(rect[key]);
      const key = JSON.stringify(rect);
      if (key === sent) return;
      sent = key; pending = true;
      tauriInvoke('set_movie_viewport', rect).catch(() => {
        failed = true;
        setHostError('The native video layout is unavailable. The wall and playback controls are still available.');
      }).finally(() => { pending = false; });
    };
    frame = requestAnimationFrame(publishViewport);
    return () => { cancelAnimationFrame(frame); removeEventListener('keydown', leaveFullscreen); delete window.movieNightNativeMode; delete window.movieNightNativeFullscreen; delete window.movieNightNativeWindowState; document.documentElement.classList.remove('movie-night-native-shell'); };
  }, []);

  function openConcierge() {
    focusChatOnOpen.current = true;
    setPaneVisible(true);
    // An explicit Ask action reveals the existing conversation at this app's
    // right edge. It never creates a new thread or a second docking system.
    if (dock.targets.some(target => target.id === TARGET.id)) snapChat(TARGET.id);
    setChatSide('right'); setChatView('foreground'); setChatOpen(true);
  }
  function closeConcierge() {
    setChatOpen(false);
    requestAnimationFrame(() => chatButton.current?.focus({ preventScroll: true }));
  }
  function openSettings() {
    setSettingsContext(nativeActive ? 'playback' : dock.open ? 'concierge' : wallContext.current);
    setSettingsOpen(true);
  }
  function closePane() { if (native) nativeWindowAction('close'); else setPaneVisible(false); }
  function minimizePane() { if (native) nativeWindowAction('minimize'); else setPaneVisible(false); }
  function saveGeometry(value) {
    try { localStorage.setItem(GEOMETRY, JSON.stringify(value)); } catch { /* Layout remains usable for this session. */ }
  }
  function reloadWall(collectionId) {
    // Saving a collection only refreshes the catalogue. It never starts a film.
    wall.current?.contentWindow?.postMessage({ type: 'movie-night:library-updated', collectionId }, location.origin);
  }
  function getCubeContext() { return wall.current?.contentWindow?.movieNightCubeContext?.() || null; }
  async function reviewCube(operation) {
    const child=wall.current?.contentWindow;
    if(!child||child.location.origin!==location.origin||typeof child.movieNightReviewCube!=='function')throw new Error('The cube editor is still loading. No change was made.');
    if(nativeActive)throw new Error('Return to the library before reviewing a cube. Playback was not changed.');
    const iframe=wall.current;
    let onReload;
    const interrupted=new Promise(resolve=>{onReload=()=>resolve({status:'unconfirmed',action:operation.action,cube_id:operation.cube_id,revision:null});iframe.addEventListener('load',onReload,{once:true});});
    setChatOpen(false);
    try { return await Promise.race([child.movieNightReviewCube(operation),interrupted]); }
    finally { iframe.removeEventListener('load',onReload);openConcierge(); }
  }
  const chat = <Concierge getCubeContext={getCubeContext} onReviewCube={reviewCube} selection={selection} onOpenSettings={() => { setSettingsContext('concierge'); setSettingsOpen(true); }} onClose={closeConcierge} onCollectionSaved={reloadWall} />;
  const nativeFrame = native ? {
    maximized: nativeWindowState.maximized, fullscreen,
    startDragging: () => nativeWindowAction('drag'),
    startResize: direction => nativeWindowAction('resize', direction),
    toggleMaximize: () => nativeWindowAction('maximize'),
  } : undefined;
  const titleActions = native ? <><PhoneRemote native={native} /><button className="native-title-action native-title-icon" title={fullscreen ? "Exit full screen" : "Full screen"} aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => bridgeInvoke('toggle_movie_fullscreen').catch(() => setHostError('Full screen is unavailable.'))}><Maximize2 size={17} />{fullscreen && <span>Exit full screen</span>}</button></> : null;

  return <main className={`studio-app ${native ? 'studio-native' : ''} ${fullscreen ? 'studio-fullscreen' : ''}`} data-native-host={native} data-native-player-active={nativeActive}>
    {!native && <header className="studio-heading"><div className="studio-brand"><Film size={22} /><span>Movie Night</span><small>PERSONAL STUDIO</small></div><div className="studio-heading-actions"><span className="aries-status"><i />Aries</span></div></header>}
    <div className="studio-stage" ref={stage}>
      {!paneVisible && <div className="studio-empty"><Film size={42} /><h1>Your next movie night</h1><p>The wall is ready whenever you are.</p><button className="shell-primary" onClick={() => setPaneVisible(true)}>Open Movie Night</button></div>}
      <div className="movie-pane-wrap" style={{ display: paneVisible ? 'contents' : 'none' }}>
        <WindowFrame title="Movie Night" category="Entertainment" icon={Film} theme="amber" appId="personal-movie-night" windowId="personal-movie-night-window" surfaceId="personal:movie-night" chatTarget={TARGET} lane={20} isActive={!native || nativeWindowState.focused !== false} onFocus={() => {}} onClose={closePane} onMinimize={minimizePane} onOpenSettings={openSettings} onOpenChat={openConcierge} chatOpen={dock.open} chatButtonRef={chatButton} chatPanelId="movie-night-concierge" footerStatus="Aries · Local playback" nativeWindow={nativeFrame} titleBarActions={titleActions} constraintsRef={stage} initialPosition={initial.current.position} initialSize={initial.current.size} onGeometryChange={saveGeometry} tabs={[]} activeTab="wall">
          <div className={`movie-native-content ${native && dock.open && !chatMount ? 'with-concierge' : ''}`}>
            <iframe ref={wall} id="movie-wall" title="Movie Night wall and player controls" src="/?studio=1" allow="fullscreen" onLoad={connectWall} className="movie-wall-frame" />
            {native && <aside ref={chatFallback} hidden={!dock.open || Boolean(chatMount)} className="movie-native-concierge" aria-label="Movie concierge panel" />}
          </div>
        </WindowFrame>
      </div>
      <div ref={chatParking} hidden aria-hidden="true" />
      <PersistentChatPortal panelId="movie-night-concierge" target={chatMount} fallbackRef={chatFallback} parkingRef={chatParking} open={dock.open} focusOnOpenRef={focusChatOnOpen} composerSelector="#concierge-prompt">{chat}</PersistentChatPortal>
      {!native && <div style={{ display: dock.open && !chatMount ? 'contents' : 'none' }}><WindowFrame title="@ibal · Movie concierge" category="Entertainment" icon={Sparkles} theme="teal" appId="movie-night-concierge" windowId="movie-night-concierge-window" lane={30} isActive onFocus={() => {}} onClose={() => setChatOpen(false)} onMinimize={() => setChatOpen(false)} constraintsRef={stage} initialPosition={{ x: Math.max(0, innerWidth - 500), y: 20 }} initialSize={{ width: Math.max(400, Math.min(470, innerWidth - 20)), height: Math.max(380, Math.min(740, innerHeight - 170)) }} tabs={[{ id: 'chat', label: 'Movie concierge', icon: Sparkles }]} activeTab="chat"><div ref={chatFallback} className="xi-chat-session" /></WindowFrame></div>}
    </div>
    {!native && <footer className="studio-taskbar"><button className={`task-app ${paneVisible ? 'open' : ''}`} onClick={() => setPaneVisible(true)}><Film size={21} /><span>Movie Night</span><i /></button><button className={`task-app ${dock.open ? 'open' : ''}`} onClick={openConcierge}><Sparkles size={21} /><span>@ibal</span><i /></button><p>Choose a film. Make a night of it.</p></footer>}
    {hostError && <div className="host-error" role="status">{hostError}<button onClick={() => setHostError('')} aria-label="Dismiss notice">×</button></div>}
    <MovieSettings open={settingsOpen} context={settingsContext} store={settingsStore} transparency={nativeWindowState.transparency} native={native} onClose={() => setSettingsOpen(false)} onPreviewAppearance={setAppearancePreview} />
    <Toaster theme="dark" />
  </main>;
}

class ShellBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <main className="shell-failure"><h1>Movie Night’s shell could not open.</h1><p>{this.state.error.message}</p><a href="/">Open the movie wall</a></main> : this.props.children; }
}

createRoot(document.getElementById('root')).render(<ShellBoundary><BrowserRouter><SnapGuideProvider><GridProvider><StudioMovieNight /></GridProvider></SnapGuideProvider></BrowserRouter></ShellBoundary>);
