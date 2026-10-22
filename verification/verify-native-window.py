#!/usr/bin/env python3
"""Verify that Studio chrome operates the actual, undecorated X11 window.

Root prepares a separate window-check test binary as for
verify-native-surface.py: its native.rs differs from the production source ONLY
in RUNTIME, which points at the private window-check directory. No player is
prepared or started by this runner. It never opens a player socket or receipt.

Start a separate tauri-driver on a display with an existing window manager,
with XDG_DATA_HOME, XDG_CONFIG_HOME and XDG_CACHE_HOME pointing to private
directories BELOW window-check. Leave XDG_RUNTIME_DIR and the session bus
unchanged. Pass that driver's PID so isolation is checked BEFORE session
creation, not after an application has already opened the real profile.

    DISPLAY=:0 python3 verify-native-window.py --driver-pid <test-driver-pid>

Options: --display, --driver-url (loopback only), --driver-pid. Existing
production Movie Night processes, profiles and windows are never selected.
The report and screenshots remain in the private verification runtime.
"""
import argparse
import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import stat
import subprocess
import time
import urllib.parse
import urllib.request


BASE = Path('/home/chrishallberg/Documents/Personal-Movies')
LIVE_RUNTIME = BASE / 'movie-night-runtime'
TEST_RUNTIME = LIVE_RUNTIME / 'window-check'
TEST_BINARY = TEST_RUNTIME / 'bin/movie-night-desktop'
SOURCE = BASE / 'movie-night/desktop/src/native.rs'
TEST_SOURCE = TEST_RUNTIME / 'source/src/native.rs'
PROFILE_KEYS = ('XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME')
FRAME = '.xi-window[data-native-frame="true"]'
REPORT = {'pass': False, 'media_started': 0, 'media_prepared': False,
          'player_socket_access': False, 'live_receipt_access': False,
          'profile_storage_reset': False, 'cases': [],
          'network_guard_scope': 'Installed after page load; startup status GETs are not claimed intercepted.'}


class Blocked(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def safe_error(error):
    return re.sub(r'https?://\S+', '[URL omitted]', str(error))[:600]


def private_directory(path):
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid()
            and not info.st_mode & 0o077, 'Verification directory must be private and owned by this user')


def process_environment(pid):
    # Only the expected test process is inspected. Never return or log the
    # environment: retain this small allowlist, which cannot contain RD keys.
    require(Path('/proc', str(pid)).stat().st_uid == os.getuid(), 'Test process belongs to another user')
    selected = {}
    for item in Path('/proc', str(pid), 'environ').read_bytes().split(b'\0'):
        name, separator, value = item.partition(b'=')
        key = name.decode('ascii', errors='ignore')
        if separator and key in (*PROFILE_KEYS, 'DISPLAY'):
            selected[key] = value.decode('utf-8', errors='strict')
    return selected


def profile_environment(pid):
    selected = process_environment(pid)
    for key in PROFILE_KEYS:
        value = selected.get(key)
        require(value and Path(value).is_absolute(), 'Test process lacks an explicit private XDG profile')
        path = Path(value)
        require(path.resolve().is_relative_to(TEST_RUNTIME.resolve()) and path.resolve() != TEST_RUNTIME.resolve(),
                'Test process profile is outside the verification runtime')
        private_directory(path)
    require(selected.get('DISPLAY') == args.display, 'Test process and verifier DISPLAY differ')
    return selected


def driver_owns_listener(pid, port):
    sockets = set()
    for table in ('tcp', 'tcp6'):
        for line in Path('/proc/net', table).read_text().splitlines()[1:]:
            columns = line.split()
            if len(columns) > 9 and columns[3] == '0A' and int(columns[1].rsplit(':', 1)[1], 16) == port:
                sockets.add('socket:[' + columns[9] + ']')
    for descriptor in Path('/proc', str(pid), 'fd').iterdir():
        try:
            if os.readlink(descriptor) in sockets:
                return True
        except FileNotFoundError:
            continue
    return False


def run(command, *, check=True):
    return subprocess.run(command, env=test_env, capture_output=True, text=True, check=check, timeout=8)


def http(path, data=None, method=None):
    request = urllib.request.Request(args.driver_url.rstrip('/') + path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}, method=method)
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.load(response).get('value')
    if isinstance(result, dict) and result.get('error'):
        raise RuntimeError(result.get('message', 'WebDriver command failed'))
    return result


def execute(script, values=None):
    return http(prefix + '/execute/sync', {'script': script, 'args': values or []})


def native(action='state'):
    result = http(prefix + '/execute/async', {'script': '''
      const done=arguments[arguments.length-1];
      window.__TAURI__.core.invoke('native_movie_window',{action:arguments[0]})
        .then(state=>done({ok:true,state})).catch(()=>done({ok:false}));
    ''', 'args': [action]})
    require(isinstance(result, dict) and result.get('ok'), 'Native window command failed')
    return result['state']


def wait_for(action, predicate, message, seconds=8):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            value = action()
            REPORT['last_observation'] = value
            if predicate(value):
                return value
        except (OSError, RuntimeError, subprocess.SubprocessError) as error:
            REPORT['last_observation_error'] = safe_error(error)
        time.sleep(0.1)
    raise RuntimeError(message)


def xinfo(window_id):
    output = run(['/usr/bin/xwininfo', '-id', str(window_id)]).stdout
    result = {'xid': int(window_id)}
    for field, key in [('Width', 'width'), ('Height', 'height'), ('Border width', 'border'),
                       ('Absolute upper-left X', 'x'), ('Absolute upper-left Y', 'y')]:
        found = re.search(re.escape(field) + r':\s+(-?\d+)', output)
        require(found is not None, 'X11 window geometry is unavailable')
        result[key] = int(found.group(1))
    found = re.search(r'Map State:\s+(\w+)', output)
    result['mapped'] = bool(found and found.group(1) == 'IsViewable')
    return result


def property_numbers(output, name):
    found = re.search(r'^' + re.escape(name) + r'\([^\n]*?\)\s*=\s*([^\n]+)', output, re.MULTILINE)
    return [int(value, 0) for value in re.findall(r'0x[0-9a-fA-F]+|-?\d+', found.group(1))] if found else None


def window_properties(window_id):
    output = run(['/usr/bin/xprop', '-id', str(window_id), '_NET_WM_PID', '_NET_WM_STATE',
                  'WM_STATE', '_NET_FRAME_EXTENTS', '_GTK_FRAME_EXTENTS', '_MOTIF_WM_HINTS']).stdout
    state_line = re.search(r'^_NET_WM_STATE\(ATOM\)\s*=([^\n]*)', output, re.MULTILINE)
    return {'pid': (property_numbers(output, '_NET_WM_PID') or [None])[0],
            'states': re.findall(r'_NET_WM_STATE_[A-Z_]+', state_line.group(1)) if state_line else [],
            'iconic': bool(re.search(r'window state:\s*Iconic', output, re.IGNORECASE)),
            'frame_extents': property_numbers(output, '_NET_FRAME_EXTENTS'),
            'gtk_frame_extents': property_numbers(output, '_GTK_FRAME_EXTENTS'),
            'motif_hints': property_numbers(output, '_MOTIF_WM_HINTS')}


def request_frame_extents(window_id):
    """Ask the WM through EWMH; never create/change the extents property.

    https://specifications.freedesktop.org/wm/latest/ar01s04.html
    EWMH defines this primarily as a pre-map estimate. A mapped, undecorated
    window may receive no reply; that is recorded, not converted into zeros.
    """
    require(window_id == xid and window_properties(window_id)['pid'] == app_pid,
            'Frame extents may only be requested for the verified test window')

    class Data(ctypes.Union):
        _fields_ = [('b', ctypes.c_char * 20), ('s', ctypes.c_short * 10), ('l', ctypes.c_long * 5)]

    class ClientMessage(ctypes.Structure):
        _fields_ = [('type', ctypes.c_int), ('serial', ctypes.c_ulong), ('send_event', ctypes.c_int),
                    ('display', ctypes.c_void_p), ('window', ctypes.c_ulong), ('message_type', ctypes.c_ulong),
                    ('format', ctypes.c_int), ('data', Data)]

    class Event(ctypes.Union):
        _fields_ = [('xclient', ClientMessage), ('pad', ctypes.c_long * 24)]

    xlib = ctypes.CDLL('libX11.so.6')
    xlib.XOpenDisplay.argtypes = [ctypes.c_char_p]
    xlib.XOpenDisplay.restype = ctypes.c_void_p
    xlib.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    xlib.XDefaultRootWindow.restype = ctypes.c_ulong
    xlib.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
    xlib.XInternAtom.restype = ctypes.c_ulong
    xlib.XSendEvent.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_long, ctypes.POINTER(Event)]
    xlib.XSendEvent.restype = ctypes.c_int
    xlib.XFlush.argtypes = [ctypes.c_void_p]
    xlib.XFlush.restype = ctypes.c_int
    xlib.XCloseDisplay.argtypes = [ctypes.c_void_p]
    xlib.XCloseDisplay.restype = ctypes.c_int
    display = xlib.XOpenDisplay(args.display.encode())
    require(display, 'Cannot open the test display to request WM frame extents')
    try:
        event = Event()
        event.xclient.type = 33  # ClientMessage, X11/X.h.
        event.xclient.send_event = 1
        event.xclient.display = display
        event.xclient.window = window_id
        event.xclient.message_type = xlib.XInternAtom(display, b'_NET_REQUEST_FRAME_EXTENTS', 0)
        event.xclient.format = 32
        # Zero-initialized data; request is delivered to the root's WM listeners.
        masks = (1 << 19) | (1 << 20)  # SubstructureNotifyMask | SubstructureRedirectMask.
        sent = xlib.XSendEvent(display, xlib.XDefaultRootWindow(display), 0, masks, ctypes.byref(event))
        require(sent != 0, 'X11 did not send the frame-extents request')
        xlib.XFlush(display)
    finally:
        xlib.XCloseDisplay(display)
    evidence = {'message': '_NET_REQUEST_FRAME_EXTENTS', 'sent': True,
                'reply_seen': False, 'frame_extents': None, 'property_written_by_verifier': False}
    deadline = time.monotonic() + 2.5
    while time.monotonic() < deadline:
        extents = window_properties(window_id)['frame_extents']
        if extents is not None:
            evidence.update({'reply_seen': True, 'frame_extents': extents})
            break
        time.sleep(0.1)
    return evidence


def decoration_basis(client, outer, native_state, properties):
    require(native_state['decorated'] is False, 'Native window still requests system decorations')
    require(all(abs(outer[key] - client[key]) <= 1 for key in ('x', 'y', 'width', 'height')),
            'An outer system frame adds decoration extents')
    require(client['border'] == 0, 'Native X11 client retains an outside border')
    require(all(abs(client[key] - native_state[key]) <= 1 for key in ('x', 'y')),
            'Actual X11 client origin differs from the native outer window origin')
    for key in ('frame_extents', 'gtk_frame_extents'):
        extents = properties[key]
        require(extents is None or (len(extents) == 4 and all(value == 0 for value in extents)),
                'Window manager or GTK reports nonzero decoration extents')
    if properties['frame_extents'] is not None:
        return 'explicit_zero_wm_extents_and_matching_geometry'
    motif = properties['motif_hints']
    require(motif and len(motif) >= 3 and motif[0] & 2 and motif[2] == 0,
            'Absent WM frame extents require an explicit undecorated Motif request as well as matching geometry')
    return 'wm_property_absent_after_request_with_matching_geometry_and_undecorated_hints'


def wm_environment():
    output = run(['/usr/bin/xprop', '-root', '_NET_SUPPORTING_WM_CHECK', '_NET_CURRENT_DESKTOP',
                  '_NET_WORKAREA', '_NET_SUPPORTED']).stdout
    manager = re.search(r'^_NET_SUPPORTING_WM_CHECK[^\n]*?(0x[0-9a-fA-F]+)', output, re.MULTILINE)
    if not manager or int(manager.group(1), 16) == 0:
        raise Blocked('This display has no detectable EWMH window manager; OS window behavior cannot be verified')
    desktop = (property_numbers(output, '_NET_CURRENT_DESKTOP') or [0])[0]
    areas = property_numbers(output, '_NET_WORKAREA')
    require(areas and len(areas) >= (desktop + 1) * 4, 'Window manager work area is unavailable')
    x, y, width, height = areas[desktop * 4:desktop * 4 + 4]
    supported = set(re.findall(r'_NET_[A-Z_]+', output))
    for name in ('_NET_WM_STATE_MAXIMIZED_HORZ', '_NET_WM_STATE_MAXIMIZED_VERT', '_NET_ACTIVE_WINDOW'):
        if name not in supported:
            raise Blocked('Window manager does not advertise the required window-state operations')
    return {'manager_xid': int(manager.group(1), 16), 'desktop': desktop,
            'work_area': {'x': x, 'y': y, 'width': width, 'height': height}}


def rectangle_intersection(first, second):
    left = max(first['x'], second['x'])
    top = max(first['y'], second['y'])
    right = min(first['x'] + first['width'], second['x'] + second['width'])
    bottom = min(first['y'] + first['height'], second['y'] + second['height'])
    return {'x': left, 'y': top, 'width': max(0, right - left), 'height': max(0, bottom - top)}


def parse_xrandr_monitors(output):
    monitors = []
    for line in output.splitlines():
        found = re.match(r'^\s*\d+:\s+(\S+)\s+(\d+)(?:/\d+)?x(\d+)(?:/\d+)?([+-]\d+)([+-]\d+)(?:\s+.*)?$', line)
        if not found:
            continue
        label, width, height, x, y = found.groups()
        if int(width) > 0 and int(height) > 0:
            monitors.append({'name': label.lstrip('+*')[:80], 'primary': '*' in label,
                             'x': int(x), 'y': int(y), 'width': int(width), 'height': int(height)})
    return monitors


def window_monitor_work_area(window_geometry, desktop_work_area):
    # XRandR rectangles and xwininfo use physical screen pixels. In particular,
    # the root EWMH work area is a virtual-desktop rectangle, not one monitor.
    monitors = []
    source = 'XRandR active monitors'
    try:
        result = run(['/usr/bin/xrandr', '--listactivemonitors'], check=False)
        if result.returncode == 0:
            monitors = parse_xrandr_monitors(result.stdout)
    except (OSError, subprocess.SubprocessError):
        pass
    if not monitors:
        source = 'GDK X11 monitors converted to physical pixels'
        code = '''import gi,json
gi.require_version('Gdk','3.0')
from gi.repository import Gdk
d=Gdk.Display.get_default()
if d is None: raise RuntimeError('No GDK display')
rows=[]
for i in range(d.get_n_monitors()):
 m=d.get_monitor(i);r=m.get_geometry();s=m.get_scale_factor()
 rows.append({'name':'monitor-'+str(i),'primary':m.is_primary(),
  'x':r.x*s,'y':r.y*s,'width':r.width*s,'height':r.height*s})
print(json.dumps(rows))
'''
        monitors = json.loads(run(['/usr/bin/python3', '-c', code]).stdout)
    require(monitors, 'No physical monitor geometry is available')
    center_x = window_geometry['x'] + window_geometry['width'] / 2
    center_y = window_geometry['y'] + window_geometry['height'] / 2
    centered = [monitor for monitor in monitors
                if monitor['x'] <= center_x < monitor['x'] + monitor['width']
                and monitor['y'] <= center_y < monitor['y'] + monitor['height']]

    def overlap_area(monitor):
        intersection = rectangle_intersection(window_geometry, monitor)
        return intersection['width'] * intersection['height']

    selected = max(centered or monitors, key=lambda monitor: (overlap_area(monitor), bool(monitor.get('primary'))))
    require(overlap_area(selected) > 0, 'Test native window does not intersect an active monitor')
    work_area = rectangle_intersection(selected, desktop_work_area)
    require(work_area['width'] > 0 and work_area['height'] > 0,
            'Test monitor has no usable intersection with the WM work area')
    return {'source': source, 'monitors': monitors, 'selected_monitor': selected,
            'selection': 'window center' if centered else 'largest window intersection',
            'desktop_work_area': desktop_work_area, 'work_area': work_area}


def outer_ancestor(window_id):
    chain = []
    current = int(window_id)
    for _ in range(8):
        geometry = xinfo(current)
        chain.append(geometry)
        output = run(['/usr/bin/xwininfo', '-id', str(current), '-tree']).stdout
        parent = re.search(r'Parent window id:\s*(0x[0-9a-fA-F]+)', output)
        root = re.search(r'Root window id:\s*(0x[0-9a-fA-F]+)', output)
        require(parent and root, 'X11 window ancestry is unavailable')
        next_id = int(parent.group(1), 16)
        if next_id in (0, int(root.group(1), 16)):
            return chain
        require(next_id not in [entry['xid'] for entry in chain], 'X11 window ancestry contains a cycle')
        current = next_id
    raise RuntimeError('Unexpectedly deep native window ancestry')


def dom_state():
    return execute('''
      const rect=(element)=>{
        if(!element)return null;
        const r=element.getBoundingClientRect(),s=getComputedStyle(element);
        return {x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,
          visibility:s.visibility,transform:s.transform,hidden:element.hidden,
          visible:r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
      };
      const frame=document.querySelector('.xi-window[data-native-frame="true"]');
      const iframe=document.getElementById('movie-wall');
      return {native:window.__MOVIE_NIGHT_NATIVE__===true,
        studioNative:!!document.querySelector('.studio-native'),width:innerWidth,height:innerHeight,
        devicePixelRatio,hidden:document.hidden,frameCount:document.querySelectorAll('.xi-window').length,
        nativeFrameCount:document.querySelectorAll('.xi-window[data-native-frame="true"]').length,
        frame:rect(frame),iframe:rect(iframe),
        outerHeading:rect(document.querySelector('.studio-heading')),
        taskbar:rect(document.querySelector('.studio-taskbar')),
        chat:Array.from(document.querySelectorAll('.concierge')).map(element=>({
          ...rect(element),docked:!!element.closest('[data-chat-drop-target]'),
          nativePane:!!element.closest('.movie-native-concierge'),insideFrame:!!frame?.contains(element)
        })),
        hostErrors:Array.from(document.querySelectorAll('.host-error')).map(e=>
          e.textContent.trim().replace(/https?:\\/\\/\\S+/g,'[URL omitted]').slice(0,400)),
        guards:{parent:window.__nativeWindowVerificationGuard===true,
          child:iframe?.contentWindow?.__nativeWindowVerificationGuard===true,
          blockedWrites:window.__nativeWindowVerificationBlockedWrites||0,
          mockedReads:window.__nativeWindowVerificationMockedReads||0}};
    ''')


def assert_fill(snapshot):
    dom = snapshot['dom']
    require(dom['native'] and dom['studioNative'] and dom['frameCount'] == 1 and dom['nativeFrameCount'] == 1,
            'Native Studio must contain exactly one native WindowFrame')
    frame = dom['frame']
    require(frame and frame['visible'] and abs(frame['x']) <= 1 and abs(frame['y']) <= 1
            and abs(frame['width'] - dom['width']) <= 1 and abs(frame['height'] - dom['height']) <= 1,
            'Studio frame does not fill the native viewport at the origin')
    require(not dom['outerHeading'] and not dom['taskbar'], 'An outer desktop header or taskbar remains in native mode')
    scale = float(snapshot['native']['scale_factor'])
    require(math.isfinite(scale) and scale > 0, 'Native scale factor is invalid')
    require(abs(snapshot['x11']['width'] - dom['width'] * scale) <= 2
            and abs(snapshot['x11']['height'] - dom['height'] * scale) <= 2,
            'Native X11 client size and WebView size differ')
    require(not dom['hostErrors'], 'Studio reported a native host error')


def snapshot(name=None):
    result = {'native': native(), 'x11': xinfo(xid), 'wm': window_properties(xid), 'dom': dom_state()}
    REPORT['last_observation'] = result
    if name:
        REPORT['cases'].append({'name': name, **result})
    return result


def filled_snapshot(name):
    # React and the WM settle independently; retain their real observations
    # while allowing a short animation/layout frame to finish.
    value = wait_for(snapshot, lambda result: assert_fill(result) is None,
                     'Native frame did not settle at the full viewport bounds')
    REPORT['cases'].append({'name': name, **value})
    return value


def element_point(selector, *, titlebar=False):
    point = execute('''
      const element=document.querySelector(arguments[0]);if(!element)return null;
      const r=element.getBoundingClientRect();
      const fractions=arguments[1] ? [0.32,0.25,0.4,0.5] : [0.5];
      for(const f of fractions){
        const x=Math.round(r.left+r.width*f),y=Math.round(r.top+r.height/2);
        const hit=document.elementFromPoint(x,y);
        if(!hit || !element.contains(hit))continue;
        if(arguments[1] && hit.closest('button,a,input,select,textarea'))continue;
        const describe=(node)=>({tag:node.tagName,id:node.id||null,
          classes:(node.getAttribute('class')||'').slice(0,200),
          nativeResize:node.closest('[data-native-resize]')?.getAttribute('data-native-resize')||null,
          titlebar:!!node.closest('[data-xi-probe="identity"]')});
        return {x,y,target:describe(element),hit:describe(hit),
          targetRect:{x:r.x,y:r.y,width:r.width,height:r.height}};
      }return null;
    ''', [selector, titlebar])
    require(point, 'Native chrome target is missing, obscured, or not safely clickable')
    current = xinfo(xid)
    scale = native()['scale_factor']
    return {'x': round(current['x'] + point['x'] * scale),
            'y': round(current['y'] + point['y'] * scale),
            'css': point, 'scale_factor': scale, 'native_client': current}


def focus():
    native('focus')
    run(['/usr/bin/xdotool', 'windowactivate', '--sync', str(xid)])


def click(selector):
    focus()
    point = wait_for(lambda: element_point(selector), bool, 'Native window control did not become clickable')
    run(['/usr/bin/xdotool', 'mousemove', '--sync', str(point['x']), str(point['y'])])
    run(['/usr/bin/xdotool', 'click', '--clearmodifiers', '1'])


def drag(selector, dx, dy, *, titlebar=False):
    focus()
    point = element_point(selector, titlebar=titlebar)
    evidence = {'selector': selector, 'screen_point': point,
                'requested_screen_delta': {'x': dx, 'y': dy}, 'before': xinfo(xid)}
    REPORT.setdefault('gestures', []).append(evidence)
    execute('''
      window.__nativeWindowVerificationGestureEvents=[];
      if(window.__nativeWindowVerificationGestureListener)return;
      window.__nativeWindowVerificationGestureListener=(event)=>{
        if((event.type==='pointermove'||event.type==='mousemove')&&!event.buttons)return;
        const target=event.target?.nodeType===1?event.target:event.target?.parentElement;
        const row={type:event.type,trusted:event.isTrusted,clientX:event.clientX,clientY:event.clientY,
          screenX:event.screenX,screenY:event.screenY,button:event.button,buttons:event.buttons,
          pointerId:event.pointerId??null,pointerType:event.pointerType??null,
          targetTag:target?.tagName||null,targetId:target?.id||null,
          targetClasses:(target?.getAttribute('class')||'').slice(0,200),
          resizeDirection:target?.closest('[data-native-resize]')?.getAttribute('data-native-resize')||null,
          titlebar:!!target?.closest('[data-xi-probe="identity"]'),
          preventedAtCapture:event.defaultPrevented,preventedAfterDispatch:null};
        const entries=window.__nativeWindowVerificationGestureEvents;
        entries.push(row);if(entries.length>64)entries.shift();
        queueMicrotask(()=>{row.preventedAfterDispatch=event.defaultPrevented;});
      };
      for(const type of ['pointerdown','mousedown','pointermove','mousemove','pointerup','mouseup','pointercancel','click'])
        document.addEventListener(type,window.__nativeWindowVerificationGestureListener,{capture:true,passive:true});
    ''')
    run(['/usr/bin/xdotool', 'mousemove', '--sync', str(point['x']), str(point['y'])])
    run(['/usr/bin/xdotool', 'mousedown', '1'])
    try:
        time.sleep(0.2)
        for step in range(1, 9):
            run(['/usr/bin/xdotool', 'mousemove', '--sync', str(round(point['x'] + dx * step / 8)),
                 str(round(point['y'] + dy * step / 8))])
            time.sleep(0.035)
    finally:
        run(['/usr/bin/xdotool', 'mouseup', '1'], check=False)
        try:
            evidence['events'] = execute('return window.__nativeWindowVerificationGestureEvents||[]')
            evidence['after'] = xinfo(xid)
        except Exception as error:
            evidence['diagnostic_error'] = safe_error(error)


def capture(name):
    target = TEST_RUNTIME / name
    code = '''import gi,sys
gi.require_version('Gdk','3.0')
gi.require_version('GdkX11','3.0')
from gi.repository import Gdk,GdkX11
w=GdkX11.X11Window.foreign_new_for_display(Gdk.Display.get_default(),int(sys.argv[1]))
g=w.get_geometry()
p=Gdk.pixbuf_get_from_window(w,0,0,g.width,g.height)
if p is None: raise RuntimeError('Native capture unavailable')
p.savev(sys.argv[2],'png',[],[])
'''
    run(['/usr/bin/python3', '-c', code, str(xid), str(target)])
    target.chmod(0o600)
    REPORT.setdefault('screenshots', []).append(str(target))


def test_process_alive():
    if not app_pid:
        return False
    try:
        return Path('/proc', str(app_pid), 'exe').resolve(strict=True) == TEST_BINARY.resolve() \
            and Path('/proc', str(app_pid), 'stat').read_text().rsplit(')', 1)[1].split()[19] == app_start_time
    except (FileNotFoundError, ProcessLookupError):
        return False


def wm_maximized(value):
    return {'_NET_WM_STATE_MAXIMIZED_HORZ', '_NET_WM_STATE_MAXIMIZED_VERT'}.issubset(value['states'])


def minimized_evidence(value):
    # The observed target compositor keeps minimized clients mapped. Require
    # independent native, ICCCM, EWMH and document-visibility agreement instead.
    return value['native']['minimized'] is True and value['wm']['iconic'] is True \
        and '_NET_WM_STATE_HIDDEN' in value['wm']['states'] and value['dom']['hidden'] is True


def restored_minimize_evidence(value):
    return value['native']['minimized'] is False and value['wm']['iconic'] is False \
        and '_NET_WM_STATE_HIDDEN' not in value['wm']['states'] \
        and value['dom']['hidden'] is False and value['x11']['mapped'] is True


parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--driver-pid', required=True, type=int)
parser.add_argument('--driver-url', default='http://127.0.0.1:18882')
parser.add_argument('--display', default=os.environ.get('DISPLAY', ':99'))
args = parser.parse_args()
test_env = dict(os.environ, DISPLAY=args.display, GDK_BACKEND='x11')
session = None
prefix = None
app_pid = None
app_start_time = None
xid = None
runtime_validated = False
try:
    private_directory(TEST_RUNTIME)
    runtime_validated = True
    endpoint = urllib.parse.urlsplit(args.driver_url)
    require(endpoint.scheme == 'http' and endpoint.hostname in ('127.0.0.1', 'localhost', '::1')
            and endpoint.port and not endpoint.username and not endpoint.password
            and endpoint.path in ('', '/') and not endpoint.query and not endpoint.fragment,
            'WebDriver endpoint must be a local HTTP listener')
    require(Path('/proc', str(args.driver_pid), 'exe').resolve(strict=True).name == 'tauri-driver',
            'The supplied PID is not tauri-driver')
    require(driver_owns_listener(args.driver_pid, endpoint.port), 'Supplied test driver does not own that listener')
    driver_profile = profile_environment(args.driver_pid)
    REPORT['private_driver_profile_verified_before_launch'] = True
    REPORT['display'] = args.display
    REPORT['wm'] = wm_environment()
    for filename in ('player.sock', 'embed-window.json'):
        require(not (TEST_RUNTIME / filename).exists(), 'Verification runtime contains a player artifact; inspect before retrying')
    source = SOURCE.read_text()
    original = f'const RUNTIME: &str = "{LIVE_RUNTIME}";'
    replacement = f'const RUNTIME: &str = "{TEST_RUNTIME}";'
    require(source.count(original) == 1 and TEST_SOURCE.read_text() == source.replace(original, replacement),
            'Verification source must differ only in its private runtime constant')
    require(TEST_BINARY.resolve() != (LIVE_RUNTIME / 'bin/movie-night-desktop').resolve(), 'Refusing the live application')
    binary = TEST_BINARY.read_bytes()
    require(str(TEST_RUNTIME).encode() in binary, 'Verification binary lacks its isolated runtime')
    REPORT['native_source_sha256'] = hashlib.sha256(source.encode()).hexdigest()
    REPORT['verification_binary_sha256'] = hashlib.sha256(binary).hexdigest()
    result = http('/session', {'capabilities': {'alwaysMatch': {'browserName': 'wry',
        'tauri:options': {'application': str(TEST_BINARY)}}}})
    session = result['sessionId']
    prefix = '/session/' + session
    wait_for(lambda: execute('return typeof window.__TAURI__?.core?.invoke==="function" && !!document.getElementById("movie-wall")?.contentDocument?.body'),
             bool, 'Native Studio and its iframe did not load', 15)
    require(execute('return location.pathname') in ('/studio', '/studio/'), 'Unexpected native application entry')
    execute('''
      window.__nativeWindowVerificationBlockedWrites=0;
      window.__nativeWindowVerificationMockedReads=0;
      const protect=(w)=>{
        if(w.__nativeWindowVerificationGuard)return;
        w.__nativeWindowVerificationGuard=true;
        const realFetch=w.fetch.bind(w);
        w.fetch=(input,options={})=>{
          const url=new URL(typeof input==='string'?input:input.url,w.location.href);
          const method=(options.method||input?.method||'GET').toUpperCase();
          if(url.origin===location.origin && url.pathname.startsWith('/api/') && !['GET','HEAD'].includes(method)){
            window.__nativeWindowVerificationBlockedWrites++;
            return Promise.reject(new Error('API writes disabled for native window verification'));
          }
          if(url.origin===location.origin && url.pathname.startsWith('/api/player')){
            window.__nativeWindowVerificationMockedReads++;
            return Promise.resolve(new w.Response(JSON.stringify({state:'idle',title:'',imdb_id:null,
              position:0,duration:0,volume:0,muted:true,fullscreen:false}),{headers:{'Content-Type':'application/json'}}));
          }
          return realFetch(input,options);
        };
        for(const frame of w.document.querySelectorAll('iframe')){
          try{if(frame.contentWindow.location.origin===location.origin)protect(frame.contentWindow);}catch{}
          frame.addEventListener('load',()=>{try{protect(frame.contentWindow);}catch{}});
        }
      };protect(window);
    ''')
    identity = native()
    app_pid, xid = identity.get('pid'), identity.get('native_xid')
    require(isinstance(app_pid, int) and app_pid > 0 and isinstance(xid, int) and xid > 0,
            'Native state must identify its PID and actual top-level XID')
    require(Path('/proc', str(app_pid), 'exe').resolve(strict=True) == TEST_BINARY.resolve(),
            'Native state does not belong to the isolated test executable')
    app_start_time = Path('/proc', str(app_pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]
    require(profile_environment(app_pid) == driver_profile, 'Test application did not inherit the private driver profile')
    REPORT['private_application_profile_verified'] = True
    require(window_properties(xid)['pid'] == app_pid, 'X11 window belongs to a different process')
    REPORT['test_identity'] = {'pid': app_pid, 'native_xid': xid}
    focus()
    if identity['fullscreen']:
        raise RuntimeError('Isolated native app unexpectedly started fullscreen')
    if identity['maximized']:
        native('maximize')
        wait_for(lambda: native(), lambda value: not value['maximized'], 'Initial native restore failed')
    REPORT['monitor'] = window_monitor_work_area(xinfo(xid), REPORT['wm']['work_area'])
    work = REPORT['monitor']['work_area']
    initial_scale = float(identity['scale_factor'])
    require(math.isfinite(initial_scale) and initial_scale > 0, 'Initial native scale factor is invalid')
    baseline_width = min(round(1100 * initial_scale), work['width'] - round(180 * initial_scale))
    baseline_height = min(round(720 * initial_scale), work['height'] - round(160 * initial_scale))
    if baseline_width < 800 * initial_scale or baseline_height < 580 * initial_scale:
        raise Blocked('Display work area is too small for the bounded native drag and resize checks')
    run(['/usr/bin/xdotool', 'windowsize', str(xid), str(baseline_width), str(baseline_height)])
    run(['/usr/bin/xdotool', 'windowmove', str(xid), str(work['x'] + 35), str(work['y'] + 35)])
    wait_for(lambda: xinfo(xid), lambda value: abs(value['width'] - baseline_width) <= 2
             and abs(value['height'] - baseline_height) <= 2, 'Native baseline size did not settle')
    baseline = filled_snapshot('initial_native_frame')
    require(baseline['native']['decorated'] is False, 'Native window still requests system decorations')
    extents_request = {'sent': False, 'reason': 'WM property already present'}
    if baseline['wm']['frame_extents'] is None:
        REPORT['frame_extents_request'] = {'attempted': True}
        extents_request = request_frame_extents(xid)
        REPORT['frame_extents_request'] = extents_request
        baseline = snapshot('after_wm_frame_extents_request')
        assert_fill(baseline)
    ancestors = outer_ancestor(xid)
    outer = ancestors[-1]
    # A WM may render decoration without a larger reparenting X window. Keep
    # all observations before checking them, including the independent native
    # outer_position versus actual X11 client origin; Motif is only a request.
    REPORT['undecorated_outer_ancestry'] = ancestors
    REPORT['decoration_evidence'] = {
        'client': baseline['x11'], 'wm_ancestor': outer,
        'native_outer_position': {key: baseline['native'][key] for key in ('x', 'y')},
        'client_offset_from_native_outer': {
            key: baseline['x11'][key] - baseline['native'][key] for key in ('x', 'y')},
        'frame_extents': baseline['wm']['frame_extents'],
        'gtk_frame_extents': baseline['wm']['gtk_frame_extents'],
        'motif_hints_request_only': baseline['wm']['motif_hints'],
        'frame_extents_request': extents_request,
    }
    basis = decoration_basis(baseline['x11'], outer, baseline['native'], baseline['wm'])
    capture('native-window-initial.png')
    REPORT['decoration_evidence']['acceptance_basis'] = basis
    REPORT['decoration_evidence']['visual_evidence'] = str(TEST_RUNTIME / 'native-window-initial.png')
    REPORT['decoration_evidence']['visual_review'] = 'Screenshot captured for reviewer; no automated visual judgment claimed.'

    before = xinfo(xid)
    drag(FRAME + ' [data-xi-probe="identity"]', 70, 45, titlebar=True)
    moved = wait_for(lambda: xinfo(xid), lambda value: abs(value['x'] - before['x']) >= 25
                     and abs(value['y'] - before['y']) >= 15, 'Titlebar drag did not move the actual X11 window')
    dragged = filled_snapshot('os_titlebar_drag')
    require(abs(moved['width'] - before['width']) <= 2 and abs(moved['height'] - before['height']) <= 2,
            'Titlebar drag unexpectedly resized the native window')

    before = xinfo(xid)
    drag(FRAME + ' [data-native-resize="right-bottom"]', 60, 40)
    wait_for(lambda: xinfo(xid), lambda value: value['width'] - before['width'] >= 25
             and value['height'] - before['height'] >= 15, 'Resize grip did not resize the actual X11 window')
    resized = filled_snapshot('os_corner_resize')
    require(abs(resized['x11']['x'] - before['x']) <= 2 and abs(resized['x11']['y'] - before['y']) <= 2,
            'Southeast resizing moved the opposite native corner')

    # The first OS grab can consume the pointer-up event that WebKit expects.
    # A second titlebar drag after an intervening resize must still move the
    # real top-level window; a first successful drag alone cannot prove this.
    before = xinfo(xid)
    drag(FRAME + ' [data-xi-probe="identity"]', -45, -25, titlebar=True)
    repeated = wait_for(lambda: xinfo(xid),
        lambda value: before['x'] - value['x'] >= 20 and before['y'] - value['y'] >= 10,
        'Repeated titlebar drag after native grabs did not move the actual X11 window')
    filled_snapshot('os_titlebar_drag_after_resize')
    require(abs(repeated['width'] - before['width']) <= 2 and abs(repeated['height'] - before['height']) <= 2,
            'Repeated titlebar drag unexpectedly resized the native window')

    restore_geometry = xinfo(xid)
    REPORT['monitor_before_maximize'] = window_monitor_work_area(restore_geometry, REPORT['wm']['work_area'])
    maximize_work = REPORT['monitor_before_maximize']['work_area']
    click(FRAME + ' button[title="Maximize"]')
    wait_for(lambda: window_properties(xid), wm_maximized, 'Maximize button did not set native WM maximized states')
    maximized = wait_for(lambda: snapshot(), lambda value: value['native']['maximized']
                         and all(abs(value['x11'][key] - maximize_work[key]) <= 4 for key in ('x', 'y', 'width', 'height')),
                         'Native maximize did not settle at its monitor WM work area')
    assert_fill(maximized)
    require(all(abs(maximized['x11'][key] - maximize_work[key]) <= 4 for key in ('x', 'y', 'width', 'height')),
            'Maximized native bounds do not match the selected monitor work area')
    REPORT['cases'].append({'name': 'os_maximize', **maximized})
    click(FRAME + ' button[title="Restore"]')
    wait_for(lambda: window_properties(xid), lambda value: not wm_maximized(value), 'Restore left native maximized states set')
    wait_for(lambda: xinfo(xid), lambda value: all(abs(value[key] - restore_geometry[key]) <= 3
             for key in ('x', 'y', 'width', 'height')), 'Restore did not recover the prior native bounds')
    filled_snapshot('os_restore')

    # Exercise the real chrome action and keyboard path. No direct fullscreen
    # invoke or synthetic DOM key event is used to satisfy this regression.
    before_fullscreen = xinfo(xid)
    fullscreen_monitor = window_monitor_work_area(before_fullscreen, REPORT['wm']['work_area'])['selected_monitor']
    click(FRAME + ' button[aria-label="Full screen"]')
    wait_for(lambda: window_properties(xid),
        lambda value: '_NET_WM_STATE_FULLSCREEN' in value['states'],
        'Fullscreen button did not set the actual WM fullscreen state')
    wait_for(lambda: snapshot(), lambda value: value['native']['fullscreen']
        and all(abs(value['x11'][key] - fullscreen_monitor[key]) <= 4 for key in ('x', 'y', 'width', 'height')),
        'Native fullscreen did not fill the selected physical monitor')
    filled_snapshot('os_fullscreen_from_titlebar_button')
    run(['/usr/bin/xdotool', 'windowactivate', '--sync', str(xid)])
    run(['/usr/bin/xdotool', 'key', '--clearmodifiers', 'Escape'])
    wait_for(lambda: window_properties(xid),
        lambda value: '_NET_WM_STATE_FULLSCREEN' not in value['states'],
        'Real Escape input did not clear the actual WM fullscreen state')
    wait_for(lambda: snapshot(), lambda value: not value['native']['fullscreen']
        and all(abs(value['x11'][key] - before_fullscreen[key]) <= 3 for key in ('x', 'y', 'width', 'height')),
        'Escape did not restore the previous native window bounds')
    filled_snapshot('os_fullscreen_escape_restore')

    click(FRAME + ' button[title="Minimize"]')
    minimized = wait_for(snapshot, minimized_evidence,
        'Native minimized, WM iconic/HIDDEN and document-hidden states did not agree')
    REPORT['cases'].append({'name': 'os_minimize', **minimized})
    REPORT['minimize_visibility_rule'] = 'Native minimized + ICCCM Iconic + EWMH HIDDEN + document hidden; X11 mapping is recorded, not assumed.'
    run(['/usr/bin/xdotool', 'windowmap', str(xid)])
    run(['/usr/bin/xdotool', 'windowactivate', '--sync', str(xid)])
    wait_for(snapshot, restored_minimize_evidence,
        'Restore did not clear native minimized, WM iconic/HIDDEN and document-hidden states with a mapped window')
    filled_snapshot('restore_after_os_minimize')

    for label, width in (('desktop', max(1024, round(baseline_width / initial_scale))), ('tablet', 768)):
        scale = native()['scale_factor']
        pixels = round(width * scale)
        require(pixels <= work['width'], 'Requested test width exceeds the native display')
        run(['/usr/bin/xdotool', 'windowsize', str(xid), str(pixels), str(baseline_height)])
        wait_for(dom_state, lambda value: abs(value['width'] - width) <= 1, 'Native viewport width did not settle')
        # Native titlebar actions must remain the path to concierge at both sizes.
        ask_selector = execute('''
          const buttons=Array.from(document.querySelectorAll('.xi-window[data-native-frame="true"] button'));
          const target=buttons.find(button=>button.textContent.trim()==='Ask @ibal' || button.getAttribute('aria-label')==='Ask @ibal');
          if(!target)return null;
          target.setAttribute('data-native-verification-ask','true');
          return '[data-native-verification-ask="true"]';
        ''')
        require(ask_selector, 'Native frame has no Ask @ibal titlebar action')
        click(ask_selector)
        wait_for(dom_state, lambda value: any(chat['visible'] for chat in value['chat']), 'Concierge did not open')
        chat = filled_snapshot(label + '_concierge')
        visible = [item for item in chat['dom']['chat'] if item['visible']]
        require(len(visible) == 1 and visible[0]['insideFrame']
                and (visible[0]['docked'] or visible[0]['nativePane']),
                'Native concierge is not a single dock or pane inside the existing frame')
        item = visible[0]
        require(item['x'] >= -1 and item['y'] >= -1
                and item['x'] + item['width'] <= chat['dom']['width'] + 1
                and item['y'] + item['height'] <= chat['dom']['height'] + 1,
                'Native concierge overflows the native client bounds')
        capture('native-window-' + label + '-concierge.png')
        click('.concierge button[aria-label="Close concierge"]')
        wait_for(dom_state, lambda value: not any(chat['visible'] for chat in value['chat']), 'Concierge did not close')
        filled_snapshot(label + '_concierge_closed')

    guards = dom_state()['guards']
    require(guards['parent'] and guards['child'] and guards['blockedWrites'] == 0,
            'Verification guards were lost or an API write was attempted')
    REPORT['network_guards'] = guards
    require(not (TEST_RUNTIME / 'player.sock').exists() and not (TEST_RUNTIME / 'embed-window.json').exists(),
            'Window-only verification unexpectedly prepared a player artifact')
    REPORT['no_media_artifacts'] = True
    click(FRAME + ' button[title="Close"]')
    wait_for(lambda: test_process_alive(), lambda alive: not alive, 'Close button did not exit the isolated native process')
    require(run(['/usr/bin/xwininfo', '-id', str(xid)], check=False).returncode != 0,
            'Close button left the native X11 window alive')
    REPORT['native_close_exits_process_and_destroys_xid'] = True
    REPORT['pass'] = True
except Blocked as error:
    REPORT['blocked'] = True
    REPORT['error'] = safe_error(error)
except Exception as error:
    REPORT['error'] = safe_error(error)
    if xid and test_process_alive():
        # Keep independently readable parts even when one native command is
        # itself broken. In particular, an xinfo polling timeout must not erase
        # the DOM host error or the last trusted resize/pointer evidence.
        details = {}
        REPORT['failure_details'] = details
        for name, read in (('dom', dom_state), ('native', native), ('x11', lambda: xinfo(xid)),
                           ('wm', lambda: window_properties(xid)),
                           ('gesture_events', lambda: execute('return window.__nativeWindowVerificationGestureEvents||[]'))):
            try:
                details[name] = read()
            except Exception as diagnostic_error:
                details[name + '_error'] = safe_error(diagnostic_error)
        try:
            capture('native-window-failure.png')
        except Exception as capture_error:
            REPORT['capture_error'] = safe_error(capture_error)
finally:
    if session:
        try:
            http('/session/' + session, method='DELETE')
        except Exception:
            pass
    if test_process_alive():
        # This is cleanup only, never counted as proof that the Close UI works.
        os.kill(app_pid, signal.SIGTERM)
        REPORT['cleanup_terminated_test_process'] = True
    if runtime_validated:
        target = TEST_RUNTIME / 'native-window-verification.json'
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, 'w') as handle:
            json.dump(REPORT, handle, indent=2)
            handle.write('\n')
        target.chmod(0o600)
    print(json.dumps(REPORT))
    raise SystemExit(0 if REPORT['pass'] else 2 if REPORT.get('blocked') else 1)
