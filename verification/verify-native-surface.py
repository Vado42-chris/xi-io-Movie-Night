#!/usr/bin/env python3
"""Verify native viewport geometry using only an isolated paused test pattern.

Required target setup (root owns the build): copy the desktop crate into
<live-runtime>/viewport-check/source; replace ONLY its native.rs RUNTIME constant
with <live-runtime>/viewport-check; build that copy and put its executable in
<live-runtime>/viewport-check/bin/movie-night-desktop. Keep /studio unchanged.
The runner verifies the one-line source difference and the binary's test-runtime
literal before launching. It never reads or writes the live player socket or
embedding receipt, never resolves a movie, and never sends a playback HTTP POST.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import stat
import subprocess
import time
import urllib.request

BASE = Path('/home/chrishallberg/Documents/Personal-Movies')
LIVE_RUNTIME = BASE / 'movie-night-runtime'
TEST_RUNTIME = LIVE_RUNTIME / 'viewport-check'
TEST_BINARY = TEST_RUNTIME / 'bin/movie-night-desktop'
SOURCE = BASE / 'movie-night/desktop/src/native.rs'
TEST_SOURCE = TEST_RUNTIME / 'source/src/native.rs'
DRIVER = 'http://127.0.0.1:18881'
DISPLAY = ':99'  # The already designated isolated Xvfb test display only.
REPORT = {'synthetic_only': True, 'movies_started': 0, 'live_player_commands': 0,
          'live_receipt_access': False, 'frontend_callbacks_stubbed_for_geometry': True,
          'browser_profile': {'isolation_verified': False, 'profile_override_requested': False,
                              'storage_reset_by_runner': False}}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def http(path, data=None, method=None):
    request = urllib.request.Request(DRIVER + path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}, method=method)
    with urllib.request.urlopen(request, timeout=15) as response:
        value = json.load(response).get('value')
    if isinstance(value, dict) and value.get('error'):
        raise RuntimeError(value.get('message', 'WebDriver command failed'))
    return value


def ipc(command):
    # No caller-supplied socket: every command is confined to the test directory.
    info = test_socket.lstat()
    require(stat.S_ISSOCK(info.st_mode) and info.st_uid == os.getuid()
            and not info.st_mode & 0o077, 'Synthetic socket is not private')
    with socket.socket(socket.AF_UNIX) as stream:
        stream.settimeout(2)
        stream.connect(str(test_socket))
        stream.sendall(json.dumps({'command': command, 'request_id': 189}).encode() + b'\n')
        with stream.makefile('rb') as handle:
            while True:
                raw = handle.readline(65536)
                if not raw:
                    return None
                value = json.loads(raw)
                if value.get('request_id') == 189:
                    require(value.get('error') == 'success', 'Synthetic player IPC failed')
                    return value.get('data')


def xinfo(xid):
    output = subprocess.run(['/usr/bin/xwininfo', '-id', str(xid)], env=test_env,
        capture_output=True, text=True, check=True, timeout=5).stdout
    result = {}
    for field, key in [('Width', 'width'), ('Height', 'height'),
                       ('Absolute upper-left X', 'x'), ('Absolute upper-left Y', 'y')]:
        match = re.search(re.escape(field) + r':\s+(-?\d+)', output)
        require(match is not None, 'X11 geometry unavailable')
        result[key] = int(match.group(1))
    match = re.search(r'Map State:\s+(\w+)', output)
    result['mapped'] = bool(match and match.group(1) == 'IsViewable')
    return result


def wait_for(action, predicate, message, seconds=5):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            result = action()
            if predicate(result):
                return result
        except (OSError, RuntimeError, subprocess.SubprocessError):
            pass
        time.sleep(0.08)
    raise RuntimeError(message)


session = None
mpv = None
receipt = None
baseline = None
origin = None
runtime_validated = False
video_created = False
test_socket = TEST_RUNTIME / 'player.sock'
test_video = TEST_RUNTIME / 'synthetic.mp4'
test_env = dict(os.environ, DISPLAY=DISPLAY, GDK_BACKEND='x11', LIBGL_ALWAYS_SOFTWARE='1',
    LD_LIBRARY_PATH=str(LIVE_RUNTIME / 'independent-mpv/usr/lib/x86_64-linux-gnu'))
try:
    info = TEST_RUNTIME.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid()
            and not info.st_mode & 0o077, 'A separate private verification runtime is required')
    runtime_validated = True
    require(not test_socket.exists() and not (TEST_RUNTIME / 'embed-window.json').exists(),
            'Verification runtime already has a socket or receipt; inspect it before retrying')
    source = SOURCE.read_text()
    original = f'const RUNTIME: &str = "{LIVE_RUNTIME}";'
    replacement = f'const RUNTIME: &str = "{TEST_RUNTIME}";'
    require(source.count(original) == 1 and TEST_SOURCE.read_text() == source.replace(original, replacement),
            'Verification source must differ only in its private runtime constant')
    binary = TEST_BINARY.read_bytes()
    require(str(TEST_RUNTIME).encode() in binary, 'Verification binary does not contain the isolated runtime')
    require(TEST_BINARY.resolve() != (LIVE_RUNTIME / 'bin/movie-night-desktop').resolve(),
            'Refusing the live native application')
    REPORT['native_source_sha256'] = hashlib.sha256(source.encode()).hexdigest()
    REPORT['verification_binary_sha256'] = hashlib.sha256(binary).hexdigest()
    subprocess.run(['/usr/bin/ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24', '-t', '2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', str(test_video)],
        check=True, timeout=20, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    video_created = True
    result = http('/session', {'capabilities': {'alwaysMatch': {'browserName': 'wry',
        'tauri:options': {'application': str(TEST_BINARY)}}}})
    session = result['sessionId']
    prefix = '/session/' + session

    def execute(script, args=None):
        return http(prefix + '/execute/sync', {'script': script, 'args': args or []})

    def invoke(command, args=None):
        result = http(prefix + '/execute/async', {'script':
            'const done=arguments[arguments.length-1];window.__TAURI__.core.invoke(arguments[0],arguments[1]).then(v=>done({ok:true,value:v})).catch(()=>done({ok:false}));',
            'args': [command, args or {}]})
        require(isinstance(result, dict), 'Native command returned no result')
        return result

    wait_for(lambda: execute('return window.__MOVIE_NIGHT_VIEWPORT__===true && typeof window.__TAURI__?.core?.invoke==="function"'),
        bool, 'Native viewport bridge unavailable', 10)
    require(execute('return location.pathname') in ('/studio', '/studio/'), 'Studio entry was not loaded')
    wait_for(lambda: execute('return typeof window.movieNightNativeMode==="function" && typeof window.movieNightNativeFullscreen==="function" && !!document.getElementById("movie-wall")?.contentDocument?.getElementById("native-video-placeholder")'),
        bool, 'Studio callbacks and movie iframe are not ready', 10)
    # The geometry test drives native layout directly. Stub only these UI
    # callbacks so React's live rectangle publisher cannot overwrite test cases.
    # HTTP writes are blocked in the parent and each same-origin child document.
    execute('''
      window.__viewportVerificationCallbacks={
        mode:window.movieNightNativeMode,
        fullscreen:window.movieNightNativeFullscreen
      };
      window.__viewportVerificationBlockedWrites=0;
      window.movieNightNativeMode=(value)=>{window.__MOVIE_NIGHT_NATIVE_ACTIVE__=value;};
      window.movieNightNativeFullscreen=()=>{};
      const protect=(w)=>{
        if(w.__viewportVerificationGuard)return;
        w.__viewportVerificationGuard=true;
        const realFetch=w.fetch.bind(w);
        w.fetch=(input,options={})=>{
          const url=new URL(typeof input==='string'?input:input.url,w.location.href);
          const method=(options.method||input?.method||'GET').toUpperCase();
          if(url.pathname.startsWith('/api/player')){
            if(method!=='GET'){
              window.__viewportVerificationBlockedWrites++;
              return Promise.reject(new Error('Playback writes disabled for verification'));
            }
            return Promise.resolve(new w.Response(JSON.stringify({state:'paused',title:'Synthetic preview',imdb_id:'tt0000000',position:0,duration:2,volume:0,muted:true,fullscreen:false}),{headers:{'Content-Type':'application/json'}}));
          }
          return realFetch(input,options);
        };
        for(const frame of w.document.querySelectorAll('iframe')){
          try { if(frame.contentWindow.location.origin===location.origin)protect(frame.contentWindow); } catch {}
          frame.addEventListener('load',()=>{try{protect(frame.contentWindow);}catch{}});
        }
      };
      protect(window);
    ''')
    # A JS .click() does not exercise Wry's native GTK pointer/resize handler.
    # The native WindowFrame is the actual window chrome; there is no outer
    # desktop heading. Measure its inert status footer, away from the draggable
    # title/rail and native resize handles, then send a real W3C pointer click.
    pointer_target = execute('''
      const frame=document.querySelector('.xi-window[data-native-frame="true"]');
      const marker=Array.from(frame?.querySelectorAll('span')||[])
        .find(element=>element.textContent.trim()==='WINDOW OPEN');
      const footer=marker?.parentElement?.parentElement;
      if(!footer || !frame.contains(footer) || !footer.classList.contains('h-8')
          || !footer.classList.contains('border-t'))return null;
      const rect=footer.getBoundingClientRect();
      const x=Math.round(rect.left+rect.width/2),y=Math.round(rect.top+rect.height/2);
      if(rect.width<40 || rect.height<10 || x<8 || y<8
          || x>=innerWidth-8 || y>=innerHeight-8)return null;
      const hit=document.elementFromPoint(x,y);
      const controls='button,a,input,select,textarea,summary,[role="button"],'
        +'[role="menuitem"],[contenteditable="true"],[data-native-resize],'
        +'[data-xi-probe="identity"],.cursor-grab';
      if(!hit || !footer.contains(hit) || hit.closest(controls))return null;
      window.__viewportVerificationTrustedClicks=0;
      window.__viewportVerificationClickHandler=(event)=>{
        if(event.isTrusted && event.clientX===x && event.clientY===y
            && footer.contains(event.target) && !event.target.closest(controls))
          window.__viewportVerificationTrustedClicks++;
      };
      document.addEventListener('click',window.__viewportVerificationClickHandler,true);
      return {x,y,region:'native Studio status footer',
        bounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
    ''')
    require(isinstance(pointer_target, dict)
            and type(pointer_target.get('x')) is int and type(pointer_target.get('y')) is int,
            'Pointer regression target is not the inert native Studio status footer')
    REPORT['real_pointer_click_target'] = pointer_target
    http(prefix + '/actions', {'actions': [{'type': 'pointer', 'id': 'viewport-check-mouse',
        'parameters': {'pointerType': 'mouse'}, 'actions': [
            {'type': 'pointerMove', 'duration': 0, 'origin': 'viewport',
             'x': pointer_target['x'], 'y': pointer_target['y']},
            {'type': 'pointerDown', 'button': 0},
            {'type': 'pause', 'duration': 50},
            {'type': 'pointerUp', 'button': 0}]}]})
    http(prefix + '/actions', method='DELETE')
    wait_for(lambda: execute('return window.__viewportVerificationTrustedClicks'),
        lambda count: isinstance(count, int) and count > 0,
        'Real pointer click did not reach the surviving native WebView')
    execute('document.removeEventListener("click",window.__viewportVerificationClickHandler,true);delete window.__viewportVerificationClickHandler;')
    REPORT['real_pointer_click_survives'] = True
    baseline = execute('return {width:innerWidth,height:innerHeight}')
    require(baseline['width'] >= 760 and baseline['height'] >= 540, 'Full Studio viewport is too small')
    first = {'x': 120, 'y': 100, 'width': 640, 'height': 360, 'visible': True}
    state = invoke('set_movie_viewport', first)
    require(state.get('ok') and state['value']['active'] is False and state['value']['visible'] is False,
            'Geometry update activated an unowned player')
    require(not (TEST_RUNTIME / 'embed-window.json').exists(), 'Geometry update unexpectedly prepared a player')
    REPORT['inactive_geometry_stays_hidden'] = True
    require(invoke('prepare_movie_player') == {'ok': True, 'value': True}, 'Hidden preparation failed')
    receipt_path = TEST_RUNTIME / 'embed-window.json'
    info = receipt_path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and not info.st_mode & 0o077,
            'Verification receipt is not private')
    receipt = json.loads(receipt_path.read_text())
    require(receipt.get('schema') == 'movie-night.embed-window/v1', 'Invalid verification receipt')
    require(os.readlink(Path('/proc') / str(receipt['pid']) / 'exe') == str(TEST_BINARY.resolve()),
            'Receipt does not belong to the isolated verification application')
    require(not xinfo(receipt['xid'])['mapped'], 'Preparation displayed an unowned native area')
    require(invoke('show_movie_player') == {'ok': True, 'value': False}, 'Missing-player ownership gate failed')
    REPORT['prepare_stays_hidden_and_ownership_gate_passes'] = True
    command = [str(LIVE_RUNTIME / 'independent-mpv/usr/bin/mpv'), '--no-config',
        '--terminal=no', '--input-terminal=no', '--load-scripts=no', '--ytdl=no',
        '--osc=no', '--osd-bar=no', '--vo=gpu', '--gpu-context=x11egl',
        '--gpu-sw=yes', '--audio=no', '--pause=yes', '--loop-file=inf', '--log-file=',
        '--wid=' + str(receipt['xid']), '--input-ipc-server=' + str(test_socket),
        '--title=Movie Night synthetic viewport verification', str(test_video)]
    mpv = subprocess.Popen(command, env=test_env, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, umask=0o077)
    wait_for(lambda: ipc(['get_property', 'wid']), lambda value: value == receipt['xid'],
             'Synthetic player did not attach to the isolated parent')
    require(invoke('show_movie_player') == {'ok': True, 'value': True}, 'Matching synthetic player was not admitted')
    parameters = wait_for(lambda: ipc(['get_property', 'video-out-params']), bool,
                          'Synthetic player did not initialize video')
    require(ipc(['get_property', 'pause']) is True, 'Synthetic player was not paused')
    REPORT['video'] = {key: parameters.get(key) for key in ('w', 'h', 'pixelformat')}
    REPORT['cases'] = []

    def check_viewport(name, request):
        global origin
        result = invoke('set_movie_viewport', request)
        require(result.get('ok'), 'Viewport command rejected a valid rectangle')
        state = result['value']
        scale = state['scale_factor']
        require(state['active'] is True, 'Viewport update lost the admitted player state')
        if state['visible']:
            geometry = wait_for(lambda: xinfo(receipt['xid']),
                lambda g: g['mapped'] and g['width'] == state['width'] * scale
                and g['height'] == state['height'] * scale, 'Native video rectangle did not settle')
            if origin is None:
                origin = {'x': geometry['x'] - state['x'] * scale,
                          'y': geometry['y'] - state['y'] * scale}
            require(geometry['x'] == origin['x'] + state['x'] * scale
                    and geometry['y'] == origin['y'] + state['y'] * scale,
                    'Native video did not follow the supplied position')
        else:
            geometry = wait_for(lambda: xinfo(receipt['xid']), lambda g: not g['mapped'],
                                'Native video did not hide')
        require(execute('return {width:innerWidth,height:innerHeight}') == baseline,
                'Native viewport change shrank the Studio WebView')
        require(ipc(['get_property', 'pause']) is True, 'Geometry change altered paused state')
        REPORT['cases'].append({'name': name, 'accepted': state, 'native': geometry})
        return state

    check_viewport('initial', first)
    check_viewport('move_and_resize', {'x': 220, 'y': 140, 'width': 560, 'height': 315, 'visible': True})
    clipped = check_viewport('clip_top_left', {'x': -40, 'y': -20, 'width': 240, 'height': 140, 'visible': True})
    require((clipped['x'], clipped['y'], clipped['width'], clipped['height']) == (0, 0, 200, 120),
            'Top-left clipping failed')
    clipped = check_viewport('clip_bottom_right', {'x': baseline['width'] - 150, 'y': baseline['height'] - 100,
        'width': 500, 'height': 400, 'visible': True})
    require((clipped['width'], clipped['height']) == (150, 100), 'Bottom-right clipping failed')
    clipped = check_viewport('fractional_inward_rounding', {'x': 70.2, 'y': 90.2, 'width': 160.6, 'height': 90.6, 'visible': True})
    require((clipped['x'], clipped['y'], clipped['width'], clipped['height']) == (71, 91, 159, 89),
            'Logical-pixel rounding failed')
    # These cases test the geometry visibility contract, not native OS-window
    # minimize/close controls (which have their own verifier and close handshake).
    check_viewport('viewport_hidden', {**first, 'visible': False})
    check_viewport('viewport_restored', first)
    check_viewport('offscreen_hidden', {'x': baseline['width'] + 10, 'y': 20, 'width': 100, 'height': 100, 'visible': True})
    require(invoke('set_movie_viewport', {**first, 'width': -1}).get('ok') is False,
            'Negative viewport width was accepted')
    require(invoke('set_movie_viewport', {**first, 'x': 1_000_001}).get('ok') is False,
            'Unbounded viewport coordinate was accepted')
    require(invoke('set_movie_controls_height', {'height': 420}) == {'ok': True, 'value': True},
            'Controls-height compatibility call failed')
    final_preview = check_viewport('final_preview', first)
    REPORT['full_webview'] = baseline
    REPORT['invalid_inputs_rejected'] = True
    REPORT['controls_height_does_not_resize_desktop'] = True
    REPORT['paused_after_all_layout_changes'] = ipc(['get_property', 'pause']) is True
    # Capture the actual X11 application, including its native child. A WebView
    # screenshot alone cannot establish that the native video was composited.
    windows = subprocess.run(['/usr/bin/xdotool', 'search', '--all', '--pid', str(receipt['pid']),
        '--name', '^Movie Night$'], env=test_env, capture_output=True, text=True, timeout=5).stdout.split()
    require(bool(windows), 'Isolated native application window was not found')
    capture = """import gi,sys
gi.require_version('Gdk','3.0')
gi.require_version('GdkX11','3.0')
from gi.repository import Gdk,GdkX11
window=GdkX11.X11Window.foreign_new_for_display(Gdk.Display.get_default(),int(sys.argv[1]))
g=window.get_geometry()
pix=Gdk.pixbuf_get_from_window(window,0,0,g.width,g.height)
pix.savev(sys.argv[2],'png',[],[])
"""
    subprocess.run(['/usr/bin/python3', '-c', capture, windows[-1],
        str(TEST_RUNTIME / 'native-viewport-preview.png')], env=test_env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=5)
    REPORT['native_screenshot'] = str(TEST_RUNTIME / 'native-viewport-preview.png')
    require(invoke('show_movie_wall') == {'ok': True, 'value': True}, 'Return-to-wall failed')
    wait_for(lambda: xinfo(receipt['xid']), lambda g: not g['mapped'], 'Return-to-wall left video visible')
    state = invoke('set_movie_viewport', first)
    require(state.get('ok') and not state['value']['active'] and not state['value']['visible'],
            'Geometry update reactivated player mode after returning to wall')
    REPORT['return_to_wall_does_not_reactivate'] = True
    # Restore the real React callbacks, then let the parent's normal RAF bridge
    # position the synthetic native child. Do not call set_movie_viewport here:
    # the purpose is to prove the iframe-to-native layout path itself works.
    require(execute('''
      const saved=window.__viewportVerificationCallbacks;
      if(typeof saved?.mode!=='function' || typeof saved?.fullscreen!=='function')return false;
      window.movieNightNativeMode=saved.mode;
      window.movieNightNativeFullscreen=saved.fullscreen;
      delete window.__viewportVerificationCallbacks;
      return true;
    '''), 'Original Studio callbacks could not be restored')
    REPORT['frontend_callbacks_restored'] = True
    require(invoke('show_movie_player') == {'ok': True, 'value': True},
            'Synthetic player was not admitted after restoring Studio callbacks')

    def studio_geometry():
        # Save each observation before testing readiness: a hidden placeholder
        # or inactive callback is itself useful evidence, not a missing result.
        observation = {'aligned': False}
        REPORT['studio_raf_last_observation'] = observation
        REPORT['studio_raf_samples'] = REPORT.get('studio_raf_samples', 0) + 1
        diagnostics = execute('''
          const box=(element)=>{
            if(!element)return null;
            const r=element.getBoundingClientRect();
            const style=element.ownerDocument.defaultView.getComputedStyle(element);
            return {x:r.x,y:r.y,width:r.width,height:r.height,
              clientWidth:element.clientWidth,clientHeight:element.clientHeight,
              hidden:element.hidden,display:style.display,visibility:style.visibility};
          };
          const flags=(w)=>w ? {
            native:w.__MOVIE_NIGHT_NATIVE__===true,
            viewport:w.__MOVIE_NIGHT_VIEWPORT__===true,
            activeFlag:w.__MOVIE_NIGHT_NATIVE_ACTIVE__??null,
            tauriInvoke:typeof w.__TAURI__?.core?.invoke,
            shellInvoke:typeof w.__MOVIE_NIGHT_SHELL__?.invoke,
            modeCallback:typeof w.movieNightNativeMode,
            fullscreenCallback:typeof w.movieNightNativeFullscreen,
            bodyClasses:String(w.document.body?.className||'').slice(0,300),
            hidden:w.document.hidden,visibilityState:w.document.visibilityState,
            width:w.innerWidth,height:w.innerHeight,
            fetchGuard:w.__viewportVerificationGuard===true
          } : null;
          const frame=document.getElementById('movie-wall');
          const child=frame?.contentDocument;
          const placeholder=child?.getElementById('native-video-placeholder');
          const outer=frame?.getBoundingClientRect(), inner=placeholder?.getBoundingClientRect();
          let projected=null;
          if(outer && inner && frame.clientWidth && frame.clientHeight){
            const sx=outer.width/frame.clientWidth,sy=outer.height/frame.clientHeight;
            projected={x:Math.round(outer.left+inner.left*sx),y:Math.round(outer.top+inner.top*sy),
              width:Math.round(inner.width*sx),height:Math.round(inner.height*sy)};
          }
          const app=document.querySelector('.studio-app');
          const chats=Array.from(document.querySelectorAll('.concierge')).map(element=>({
            ...box(element),docked:!!element.closest('[data-chat-drop-target]')
          }));
          let savedGeometryPresent=null;
          try{savedGeometryPresent=localStorage.getItem('movie-night.studio.geometry/v1')!==null;}catch{}
          return {root:flags(window),child:flags(frame?.contentWindow),
            placeholder:box(placeholder),iframe:box(frame),iframeParent:box(frame?.parentElement),
            placeholderParent:box(placeholder?.parentElement),pane:box(document.querySelector('.movie-pane-wrap')),
            studioAttributes:app ? Object.fromEntries(Array.from(app.attributes)
              .filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value.slice(0,100)])) : null,
            hostErrors:Array.from(document.querySelectorAll('.host-error')).map(e=>
              e.textContent.trim().replace(/https?:\\/\\/\\S+/g,'[URL omitted]').slice(0,500)),
            chat:chats,savedGeometryPresent,projected,
            ready:Boolean(child?.body.classList.contains('native-player-mode') && projected &&
              inner.width>1 && inner.height>1 && !document.hidden)};
        ''')
        observation['dom'] = diagnostics
        observation['native'] = xinfo(receipt['xid'])
        projected = diagnostics.get('projected') if diagnostics else None
        observation['placeholder'] = projected
        if not projected or not diagnostics.get('ready'):
            return observation
        left = max(0, min(projected['x'], baseline['width']))
        top = max(0, min(projected['y'], baseline['height']))
        right = max(left, min(projected['x'] + projected['width'], baseline['width']))
        bottom = max(top, min(projected['y'] + projected['height'], baseline['height']))
        expected = {'x': left, 'y': top, 'width': right - left, 'height': bottom - top}
        native = observation['native']
        scale = final_preview['scale_factor']
        aligned = native['mapped'] and expected['width'] > 1 and expected['height'] > 1 \
            and native['width'] == expected['width'] * scale \
            and native['height'] == expected['height'] * scale \
            and native['x'] == origin['x'] + expected['x'] * scale \
            and native['y'] == origin['y'] + expected['y'] * scale
        observation.update({'aligned': aligned, 'expected_logical': expected,
                            'scale_factor': scale})
        return observation

    REPORT['studio_raf_alignment'] = wait_for(studio_geometry,
        lambda result: bool(result and result['aligned']),
        'Studio RAF did not align native video to the iframe placeholder', 10)
    require(execute('return {width:innerWidth,height:innerHeight}') == baseline,
            'Restored Studio callbacks changed the full WebView dimensions')
    require(ipc(['get_property', 'pause']) is True, 'Studio callback restoration changed paused state')
    REPORT['paused_after_studio_callback_restoration'] = True
    subprocess.run(['/usr/bin/python3', '-c', capture, windows[-1],
        str(TEST_RUNTIME / 'native-studio-viewport-preview.png')], env=test_env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=5)
    REPORT['studio_native_screenshot'] = str(TEST_RUNTIME / 'native-studio-viewport-preview.png')
    require(invoke('show_movie_wall') == {'ok': True, 'value': True},
            'Return-to-wall failed with the real Studio callbacks')
    wait_for(lambda: xinfo(receipt['xid']), lambda g: not g['mapped'],
             'Restored Studio callbacks left native video visible after returning to wall')
    REPORT['blocked_player_write_attempts'] = execute('return window.__viewportVerificationBlockedWrites')
    require(REPORT['blocked_player_write_attempts'] == 0, 'Verification unexpectedly attempted a player HTTP write')
    REPORT['pass'] = parameters.get('w') == 1280 and parameters.get('h') == 720
except Exception as error:
    REPORT['pass'] = False
    REPORT['error'] = str(error)[:600]
finally:
    # Only this runner's synthetic process and its private test files are touched.
    if mpv is not None and mpv.poll() is None:
        try:
            ipc(['quit'])
            mpv.wait(timeout=4)
        except Exception:
            mpv.terminate()
            mpv.wait(timeout=4)
    if session:
        try:
            http('/session/' + session, method='DELETE')
        except Exception:
            pass
    if mpv is not None:
        test_socket.unlink(missing_ok=True)
    if video_created:
        test_video.unlink(missing_ok=True)
    if runtime_validated:
        (TEST_RUNTIME / 'native-viewport-verification.json').write_text(json.dumps(REPORT, indent=2) + '\n')
    print(json.dumps(REPORT))
    raise SystemExit(0 if REPORT.get('pass') else 1)
