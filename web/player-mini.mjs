/* Geometry and input controller for the ONE existing native Movie Night player.
   Layout only: no playback, file, device, shell, provider or network authority. */
const RATIO = 9 / 16;
const DOCK = 122;
const MARGIN = 12;
const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function constrainMiniPlayer(viewWidth, viewHeight, proposed = {}) {
  const vw = Math.max(1, Math.floor(finite(viewWidth, 1)));
  const vh = Math.max(1, Math.floor(finite(viewHeight, 1)));
  const maxWidth = Math.max(1, Math.min(560, vw - MARGIN * 2, (vh - MARGIN * 2 - DOCK) / RATIO));
  const minWidth = Math.min(220, maxWidth);
  const width = clamp(finite(proposed.width, Math.min(340, maxWidth)), minWidth, maxWidth);
  const height = width * RATIO + DOCK;
  const x = clamp(finite(proposed.x, vw - width - MARGIN), MARGIN, Math.max(MARGIN, vw - width - MARGIN));
  const y = clamp(finite(proposed.y, vh - height - MARGIN), MARGIN, Math.max(MARGIN, vh - height - MARGIN));
  return Object.freeze({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
}

export function shouldHideControls({ native, playing, mini, menuOpen, keyboardFocus, pointerDown }) {
  return Boolean(native && playing && !mini && !menuOpen && !keyboardFocus && !pointerDown);
}

const LANGUAGE_NAMES = Object.freeze({
  en:'English',eng:'English',fre:'French',fra:'French',fr:'French',
  es:'Spanish',spa:'Spanish',de:'German',deu:'German',ger:'German',
  it:'Italian',ita:'Italian',pt:'Portuguese',por:'Portuguese',
  ja:'Japanese',jpn:'Japanese',ko:'Korean',kor:'Korean',
  zh:'Chinese',chi:'Chinese',zho:'Chinese',ru:'Russian',rus:'Russian',
  nl:'Dutch',dut:'Dutch',nld:'Dutch',sv:'Swedish',swe:'Swedish',
  pl:'Polish',pol:'Polish',hi:'Hindi',hin:'Hindi',ar:'Arabic',ara:'Arabic',
});
export function trackLabel(track) {
  const raw = typeof track?.language === 'string' ? track.language.trim() : '';
  const normalized = LANGUAGE_NAMES[raw.toLowerCase()] || raw || 'Language not tagged';
  return [normalized, typeof track.title === 'string' ? track.title : '', typeof track.codec === 'string' ? track.codec : ''].filter(Boolean).join(' · ');
}
export function trackNotice(tracks, probeAvailable, active) {
  if (!active) return 'Audio and subtitle tracks appear after the file starts.';
  if (!probeAvailable) return 'The player could not read track information. Playback may continue, but language options are unverified. You can choose another stream.';
  const audio = tracks.filter(t => t?.type === 'audio');
  const subs = tracks.filter(t => t?.type === 'sub');
  if (!audio.length) return 'This stream did not report an audio selection. If the dialogue is in another language, choose a different stream.';
  if (audio.length === 1 && !subs.length) return 'This file reports one audio track and no selectable subtitles. To change language, choose another stream.';
  if (audio.length === 1) return 'This file has one audio track. You can select an available subtitle track or choose another stream.';
  if (!subs.length) return 'Choose an audio track. This file reports no selectable subtitles.';
  return 'Choose an audio language or subtitle track from the playing file.';
}

/* The move and size handles live in the existing DOM toolbar OUTSIDE the native
   video rectangle so GTK embedded-video hit testing cannot swallow them. */
export function mountMiniPlayerGeometry({ doc = document, win = window, moveHandle, resizeHandle }) {
  let rect = null, drag = null, active = false;
  const apply = next => {
    rect = constrainMiniPlayer(win.innerWidth, win.innerHeight, next);
    for (const [key, value] of [['--movie-mini-left',rect.x],['--movie-mini-top',rect.y],['--movie-mini-width',rect.width],['--movie-mini-video-height',Math.round(rect.width * RATIO)]]) {
      doc.body.style.setProperty(key, value + 'px');
    }
    return rect;
  };
  const activate = () => { active = true; return apply(rect || {}); };
  const deactivate = () => { active = false; drag = null; };
  const changed = () => { if(active && rect)apply(rect); };
  const begin = (kind, event) => {
    if (!active || (event.button !== undefined && event.button !== 0)) return;
    const handle = kind === 'move' ? moveHandle : resizeHandle;
    drag = { kind, pointerId:event.pointerId, base:rect, x:event.clientX, y:event.clientY };
    handle?.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  };
  const moved = event => {
    if (!active || !drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    apply(drag.kind === 'move'
      ? { ...drag.base, x:drag.base.x + dx, y:drag.base.y + dy }
      : { ...drag.base, width: drag.base.width + dx + dy * 0.35 });
    event.preventDefault?.();
  };
  const end = event => { if (drag && (event.pointerId === drag.pointerId || event.type==='blur')) drag=null; };
  function keyboard(kind, event) {
    const axis = ({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]})[event.key];
    if (!active || !axis) return;
    const delta = event.shiftKey ? 40 : 20;
    if (kind === 'move') apply({ ...rect, x:rect.x + axis[0]*delta, y:rect.y + axis[1]*delta });
    else apply({ ...rect, width:rect.width + (axis[0] - axis[1])*delta });
    event.preventDefault();
  }
  const onMoveStart = ev => begin('move',ev), onResizeStart = ev => begin('size',ev);
  const onMoveKeyboard = ev => keyboard('move',ev), onSizeKeyboard=ev=>keyboard('size',ev);
  moveHandle?.addEventListener('pointerdown',onMoveStart);
  resizeHandle?.addEventListener('pointerdown',onResizeStart);
  moveHandle?.addEventListener('keydown',onMoveKeyboard);
  resizeHandle?.addEventListener('keydown',onSizeKeyboard);
  win.addEventListener('pointermove',moved);
  win.addEventListener('pointerup',end);
  win.addEventListener('pointercancel',end);
  win.addEventListener('resize',changed);
  win.addEventListener('blur',end);
  return Object.freeze({ activate, deactivate, geometry:()=>rect, destroy() {
    deactivate();
    moveHandle?.removeEventListener('pointerdown',onMoveStart);
    resizeHandle?.removeEventListener('pointerdown',onResizeStart);
    moveHandle?.removeEventListener('keydown',onMoveKeyboard);
    resizeHandle?.removeEventListener('keydown',onSizeKeyboard);
    win.removeEventListener('pointermove',moved);
    win.removeEventListener('pointerup',end);
    win.removeEventListener('pointercancel',end);
    win.removeEventListener('resize',changed);
    win.removeEventListener('blur',end);
  } });
}
