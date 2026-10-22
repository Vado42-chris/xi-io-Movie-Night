#!/usr/bin/env python3
"""Measure real X11 compositor pixels for Movie Night's per-surface glass.

Run beside verify-native-window.py on Aries after preparing the same private
window-check binary/profile. The binary may differ from production only in its
RUNTIME constant. An existing real X11 compositing desktop is required.

    DISPLAY=:1 python3 verify-native-glass.py --driver-pid <private-driver-pid>

The runner creates its own app session and an opaque, non-focusable GTK
backdrop. It changes only that backdrop and presentation attributes in its own
WebView. No playback, settings save, Nuvio access, or live-profile reset occurs.
All screenshots are compositor captures cropped to the owned app rectangle.
Reports stay in the private window-check runtime. The root agent owns execution.
"""
import argparse
import ast
import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import stat
import statistics
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
REPORT = {
    'pass': False, 'media_started': 0, 'media_prepared': False,
    'player_socket_access': False, 'live_receipt_access': False,
    'settings_saved': False, 'profile_storage_reset': False, 'cases': [],
    'network_guard_scope': 'Installed after page load. Startup status/settings GETs are not claimed intercepted.',
    'capture_basis': 'GDK capture of the composited X11 root, cropped to the owned app rectangle; not its backing pixmap.',
    'presentation_only': True,
}


# Reuse audited identity/geometry checks without importing the other runner's
# top-level session creation or executing any of its tests. Only these explicit
# function/class definitions are compiled, never assignments, imports or calls.
HELPERS = {
    'Blocked', 'require', 'safe_error', 'private_directory', 'process_environment',
    'profile_environment', 'driver_owns_listener', 'run', 'http', 'execute',
    'native', 'wait_for', 'xinfo', 'property_numbers', 'window_properties',
    'wm_environment', 'rectangle_intersection', 'parse_xrandr_monitors',
    'window_monitor_work_area', 'outer_ancestor', 'dom_state', 'assert_fill',
    'snapshot', 'filled_snapshot', 'focus', 'test_process_alive',
}
helper_path = Path(__file__).with_name('verify-native-window.py')
helper_source = helper_path.read_text()
helper_tree = ast.parse(helper_source, filename=str(helper_path))
helper_nodes = [node for node in helper_tree.body
                if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in HELPERS]
if {node.name for node in helper_nodes} != HELPERS or any(node.decorator_list for node in helper_nodes):
    raise RuntimeError('The native-window helper contract changed; review before execution')
exec(compile(ast.Module(body=helper_nodes, type_ignores=[]), str(helper_path), 'exec'), globals())
REPORT['helper_source_sha256'] = hashlib.sha256(helper_source.encode()).hexdigest()


def pump(seconds=0.25):
    """Let our GTK backdrop paint without starting a second main loop."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        while Gtk.events_pending():
            Gtk.main_iteration_do(False)
        time.sleep(0.01)
    Gdk.Display.get_default().sync()


def x11_surface(window_id):
    result = xinfo(window_id)
    output = run(['/usr/bin/xwininfo', '-id', str(window_id)]).stdout
    for name, key, pattern in (('Depth', 'depth', r'\d+'), ('Visual', 'visual_id', r'0x[0-9a-fA-F]+')):
        found = re.search(r'^\s*' + name + r':\s*(' + pattern + r')', output, re.MULTILINE)
        require(found, 'X11 surface depth/visual is unavailable')
        result[key] = int(found.group(1), 0)
    opacity = run(['/usr/bin/xprop', '-id', str(window_id), '_NET_WM_WINDOW_OPACITY']).stdout
    result['whole_window_opacity'] = property_numbers(opacity, '_NET_WM_WINDOW_OPACITY')
    return result


class XConnection:
    """Only the two verified, owned surfaces are restacked."""
    def __init__(self):
        self.lib = ctypes.CDLL('libX11.so.6')
        declarations = {
            'XOpenDisplay': ([ctypes.c_char_p], ctypes.c_void_p),
            'XDefaultScreen': ([ctypes.c_void_p], ctypes.c_int),
            'XDefaultRootWindow': ([ctypes.c_void_p], ctypes.c_ulong),
            'XInternAtom': ([ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int], ctypes.c_ulong),
            'XGetSelectionOwner': ([ctypes.c_void_p, ctypes.c_ulong], ctypes.c_ulong),
            'XRestackWindows': ([ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong), ctypes.c_int], ctypes.c_int),
            'XQueryTree': ([ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong),
                            ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)),
                            ctypes.POINTER(ctypes.c_uint)], ctypes.c_int),
            'XFree': ([ctypes.c_void_p], ctypes.c_int),
            'XSync': ([ctypes.c_void_p, ctypes.c_int], ctypes.c_int),
            'XCloseDisplay': ([ctypes.c_void_p], ctypes.c_int),
        }
        for name, (arguments, returns) in declarations.items():
            method = getattr(self.lib, name)
            method.argtypes, method.restype = arguments, returns
        self.display = self.lib.XOpenDisplay(args.display.encode())
        require(self.display, 'Cannot open the verified X11 display')
        self.root = int(self.lib.XDefaultRootWindow(self.display))
        screen = self.lib.XDefaultScreen(self.display)
        atom = self.lib.XInternAtom(self.display, ('_NET_WM_CM_S' + str(screen)).encode(), 1)
        self.compositor = int(self.lib.XGetSelectionOwner(self.display, atom)) if atom else 0

    def children(self):
        root, parent, count = ctypes.c_ulong(), ctypes.c_ulong(), ctypes.c_uint()
        children = ctypes.POINTER(ctypes.c_ulong)()
        require(self.lib.XQueryTree(self.display, self.root, ctypes.byref(root), ctypes.byref(parent),
                                   ctypes.byref(children), ctypes.byref(count)), 'X11 stacking order unavailable')
        try:
            return [int(children[index]) for index in range(count.value)]
        finally:
            if children:
                self.lib.XFree(children)

    def stack_owned_pair(self, outer_xid, backdrop_xid):
        require(test_process_alive() and window_properties(xid)['pid'] == app_pid,
                'Application identity changed before backdrop stacking')
        require(window_properties(backdrop_xid)['pid'] == os.getpid(), 'Backdrop is not owned by this verifier')
        require(outer_ancestor(xid)[-1]['xid'] == outer_xid, 'Application root ancestor changed')
        ordered = (ctypes.c_ulong * 2)(outer_xid, backdrop_xid)
        self.lib.XRestackWindows(self.display, ordered, 2)
        self.lib.XSync(self.display, 0)
        self.assert_adjacent(outer_xid, backdrop_xid)

    def assert_adjacent(self, outer_xid, backdrop_xid):
        children = self.children()  # XQueryTree reports bottom to top.
        require(outer_xid in children and backdrop_xid in children
                and children.index(outer_xid) == children.index(backdrop_xid) + 1,
                'Owned backdrop is not directly below the verified app surface')

    def close(self):
        if self.display:
            self.lib.XCloseDisplay(self.display)
            self.display = None


def install_guard():
    execute(r'''
      window.__nativeWindowVerificationBlockedWrites=0;
      window.__nativeWindowVerificationMockedReads=0;
      const settings={revision:0,settings:{
        appearance:{mode:'glass',opacity:82},
        browsing:{start_view:'curated',catalog:'top',card_size:'comfortable',show_ratings:true},
        playback:{preferred_quality:'balanced',prefer_small_encodes:true,default_volume:100,seek_seconds:10},
        plugins:{torrentio_enabled:true,cinemeta_enabled:true,ollama_enabled:true},
        concierge:{model:'llama3.1:8b'}}};
      const idle={state:'idle',title:'',imdb_id:null,position:0,duration:0,volume:0,muted:true,fullscreen:false};
      const blocked=()=>{window.__nativeWindowVerificationBlockedWrites++;};
      const protect=w=>{
        if(w.__nativeWindowVerificationGuard)return;
        w.__nativeWindowVerificationGuard=true;
        const realFetch=w.fetch.bind(w);
        w.fetch=(input,options={})=>{
          const method=(options.method||input?.method||'GET').toUpperCase();
          if(!['GET','HEAD'].includes(method)){
            blocked();return Promise.reject(new Error('Writes disabled during glass verification'));
          }
          const url=new URL(typeof input==='string'?input:input.url,w.location.href);
          if(url.origin===location.origin && (url.pathname.startsWith('/api/player')||url.pathname==='/api/settings')){
            window.__nativeWindowVerificationMockedReads++;
            return Promise.resolve(new w.Response(JSON.stringify(url.pathname==='/api/settings'?settings:idle),
              {headers:{'Content-Type':'application/json'}}));
          }
          return realFetch(input,options);
        };
        const open=w.XMLHttpRequest.prototype.open,send=w.XMLHttpRequest.prototype.send;
        w.XMLHttpRequest.prototype.open=function(method,...args){this.__glassMethod=String(method).toUpperCase();return open.call(this,method,...args);};
        w.XMLHttpRequest.prototype.send=function(...args){
          if(!['GET','HEAD'].includes(this.__glassMethod||'GET')){blocked();throw new Error('Writes disabled during glass verification');}
          return send.apply(this,args);
        };
        w.navigator.sendBeacon=()=>{blocked();return false;};
        w.document.addEventListener('submit',event=>{event.preventDefault();blocked();},true);
        const style=w.document.createElement('style');
        style.id='glass-verification-static-presentation';
        style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
        w.document.head.append(style);
        for(const frame of w.document.querySelectorAll('iframe')){
          try{if(frame.contentWindow.location.origin===location.origin)protect(frame.contentWindow);}catch{}
          frame.addEventListener('load',()=>{try{protect(frame.contentWindow);}catch{}});
        }
      };protect(window);
    ''')


def set_material(value):
    require(value in ('glass', 'solid'), 'Unknown presentation mode')
    execute('''
      const documents=[document,document.getElementById('movie-wall').contentDocument];
      for(const doc of documents){
        doc.documentElement.dataset.windowMaterial=arguments[0];
        doc.documentElement.style.setProperty('--movie-night-surface-opacity','0.82');
      }
    ''', [value])
    pump(0.4)


def sample_regions():
    return execute('''
      const iframe=document.getElementById('movie-wall'),child=iframe.contentDocument,ir=iframe.getBoundingClientRect();
      const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
      const chrome=document.querySelector('[data-native-frame="true"] [data-xi-probe="identity"]');
      const cr=chrome.getBoundingClientRect(),occupied=[];
      const walker=document.createTreeWalker(chrome,NodeFilter.SHOW_TEXT);
      for(let node=walker.nextNode();node;node=walker.nextNode())if(node.textContent.trim()){
        const range=document.createRange();range.selectNodeContents(node);
        for(const r of range.getClientRects())occupied.push(r);
      }
      for(const element of chrome.querySelectorAll('button,input,select,img,svg'))occupied.push(element.getBoundingClientRect());
      let gap=null;
      for(let x=cr.left+cr.width*.3;x<cr.right-20;x+=18){
        const r={x:Math.round(x),y:Math.round(cr.top+cr.height/2-5),width:12,height:10};
        const hit=document.elementFromPoint(r.x+6,r.y+5);
        if(!hit||!chrome.contains(hit))continue;
        if(occupied.some(o=>r.x<o.right+4&&r.x+r.width>o.left-4&&r.y<o.bottom+3&&r.y+r.height>o.top-3))continue;
        gap=r;break;
      }
      let wall=null;
      for(const x of [10,16,22])for(const y of [120,170,220,270,320]){
        if(wall||y+14>=ir.height)continue;
        const e=child.elementFromPoint(x,y);
        if(e&&(e===child.body||e===child.documentElement||e.matches('main.page-shell,.page-shell')))
          wall={x:ir.x+x-3,y:ir.y+y-3,width:6,height:6};
      }
      let patch=document.getElementById('glass-verification-opaque-control');
      if(!patch){
        patch=document.createElement('div');patch.id='glass-verification-opaque-control';
        patch.setAttribute('aria-hidden','true');
        patch.style.cssText='position:fixed;right:28px;bottom:28px;width:72px;height:48px;background:rgb(34,119,204);opacity:1;z-index:2147483000;pointer-events:none;border:0;border-radius:0;box-shadow:none';
        document.body.append(patch);
      }
      const pr=patch.getBoundingClientRect();
      const samples={chrome:gap,wall_background:wall,
        opaque_control:{x:pr.x+20,y:pr.y+16,width:20,height:16}};
      const poster=Array.from(child.querySelectorAll('img.poster-image')).find(img=>{
        const r=img.getBoundingClientRect(),s=child.defaultView.getComputedStyle(img);
        return img.complete&&img.naturalWidth>0&&s.display!=='none'&&s.visibility!=='hidden'
          &&r.width>35&&r.height>50&&r.left>=0&&r.top>=0&&r.right<ir.width&&r.bottom<ir.height;
      });
      if(poster){
        const r=poster.getBoundingClientRect();
        samples.poster={x:ir.x+r.x+r.width/2-6,y:ir.y+r.y+r.height/2-6,width:12,height:12};
        poster.setAttribute('data-glass-verification-poster','true');
      }
      const opacityChain=[];
      for(let element=patch;element;element=element.parentElement)
        opacityChain.push({tag:element.tagName,id:element.id,opacity:getComputedStyle(element).opacity});
      return {samples,iframe:rect(iframe),chrome:rect(chrome),opaque_control_rgb:[34,119,204],
        poster_used:!!poster,opacity_chain:opacityChain,
        root_material:document.documentElement.dataset.windowMaterial,
        child_material:child.documentElement.dataset.windowMaterial};
    ''')


def pixel_values(pixbuf, region):
    pixels = pixbuf.get_pixels()
    channels, stride = pixbuf.get_n_channels(), pixbuf.get_rowstride()
    require(channels in (3, 4) and pixbuf.get_bits_per_sample() == 8, 'Unsupported screenshot pixel format')
    x, y, width, height = (int(region[key]) for key in ('x', 'y', 'width', 'height'))
    require(x >= 0 and y >= 0 and width > 0 and height > 0
            and x + width <= pixbuf.get_width() and y + height <= pixbuf.get_height(), 'Sample lies outside owned capture')
    return [tuple(pixels[row * stride + column * channels + color] for color in range(3))
            for row in range(y, y + height) for column in range(x, x + width)]


def mean_rgb(values):
    return [round(statistics.mean(value[channel] for value in values), 3) for channel in range(3)]


def compare(first, second):
    require(len(first) == len(second) and first, 'Pixel samples have different dimensions')
    signed = [statistics.mean(after[channel] - before[channel] for before, after in zip(first, second))
              for channel in range(3)]
    absolute = [abs(after[channel] - before[channel]) for before, after in zip(first, second) for channel in range(3)]
    return {'first_rgb': mean_rgb(first), 'second_rgb': mean_rgb(second),
            'signed_delta_rgb': [round(value, 3) for value in signed],
            'mean_absolute_delta': round(statistics.mean(absolute), 3),
            'max_absolute_delta': max(absolute)}


def root_pixels(geometry):
    # GTK 3 documents that both the source rectangle and returned pixel size
    # respect the GdkWindow scale factor. Keep all recorded samples physical.
    # https://docs.gtk.org/gdk3/func.pixbuf_get_from_window.html
    root = Gdk.get_default_root_window()
    scale = root.get_scale_factor()
    require(scale > 0 and all(geometry[key] % scale == 0 for key in ('x', 'y', 'width', 'height')),
            'Root capture cannot align the owned rectangle to physical pixels')
    pixbuf = Gdk.pixbuf_get_from_window(root, geometry['x'] // scale, geometry['y'] // scale,
                                      geometry['width'] // scale, geometry['height'] // scale)
    require(pixbuf and pixbuf.get_width() == geometry['width'] and pixbuf.get_height() == geometry['height'],
            'Composited root capture has an unexpected physical-pixel size')
    return pixbuf


def capture(mode, color_name):
    color = 0.0 if color_name.startswith('black') else 1.0
    rgba = Gdk.RGBA(red=color, green=color, blue=color, alpha=1.0)
    backdrop.override_background_color(Gtk.StateFlags.NORMAL, rgba)
    backdrop_box.override_background_color(Gtk.StateFlags.NORMAL, rgba)
    backdrop.queue_draw()
    pump(0.45)
    connection.assert_adjacent(outer_xid, backdrop_xid)
    current = snapshot()
    assert_fill(current)
    require(current['native']['focused'] is True and not current['native']['minimized']
            and not current['native']['fullscreen'] and not current['native']['maximized'],
            'App focus or window state changed during the backdrop comparison')
    require(all(current['x11'][key] == geometry[key] for key in ('x', 'y', 'width', 'height')),
            'Application moved or resized during pixel comparison')
    require(window_properties(backdrop_xid)['pid'] == os.getpid(), 'Backdrop ownership changed')
    materials = execute('return [document.documentElement.dataset.windowMaterial,document.getElementById("movie-wall").contentDocument.documentElement.dataset.windowMaterial]')
    require(materials == [mode, mode], 'A settings callback changed the presentation under measurement')
    pixbuf = root_pixels(geometry)
    path = TEST_RUNTIME / ('native-glass-' + mode + '-' + color_name + '.png')
    require(not path.is_symlink(), 'Refusing a screenshot symlink')
    pixbuf.savev(str(path), 'png', [], [])
    path.chmod(0o600)
    REPORT.setdefault('screenshots', []).append(str(path))
    values = {name: pixel_values(pixbuf, rect) for name, rect in physical_samples.items()}
    # This strip is inside the owned backdrop, outside the app's frame. Only its
    # RGB summary is retained. It verifies that the controlled background really
    # changed; the private screenshot above remains cropped to the app itself.
    strip = {'x': geometry['x'] - 28, 'y': geometry['y'] + 70, 'width': 4, 'height': 12}
    strip_pixels = root_pixels(strip)
    strip_rgb = mean_rgb(pixel_values(strip_pixels, {'x': 0, 'y': 0, 'width': 4, 'height': 12}))
    expected = 0 if color == 0 else 255
    require(all(abs(value - expected) <= 5 for value in strip_rgb), 'Owned backdrop did not paint the expected opaque color')
    REPORT['cases'].append({'name': mode + '_' + color_name, 'backdrop_rgb': strip_rgb,
                            'sample_rgb': {name: mean_rgb(rows) for name, rows in values.items()},
                            'focused': current['native']['focused'], 'frame_fills_native_viewport': True})
    return values


parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--driver-pid', required=True, type=int)
parser.add_argument('--driver-url', default='http://127.0.0.1:18882')
parser.add_argument('--display', default=os.environ.get('DISPLAY', ':1'))
args = parser.parse_args()
test_env = dict(os.environ, DISPLAY=args.display, GDK_BACKEND='x11')
session = prefix = app_pid = app_start_time = xid = None
backdrop = backdrop_box = connection = None
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
        require(not (TEST_RUNTIME / filename).exists(), 'Verification runtime contains a player artifact')
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
    os.environ['DISPLAY'], os.environ['GDK_BACKEND'] = args.display, 'x11'
    import gi
    gi.require_version('Gtk', '3.0')
    gi.require_version('Gdk', '3.0')
    gi.require_version('GdkX11', '3.0')
    from gi.repository import Gtk, Gdk, GdkX11
    initialized = Gtk.init_check([])
    require(bool(initialized[0] if isinstance(initialized, tuple) else initialized), 'GTK cannot use this X11 display')
    connection = XConnection()
    if not connection.compositor:
        raise Blocked('The real X11 display has no compositing-manager selection owner')
    REPORT['independent_compositor_owner_xid'] = connection.compositor
    result = http('/session', {'capabilities': {'alwaysMatch': {'browserName': 'wry',
                   'tauri:options': {'application': str(TEST_BINARY)}}}})
    session = result['sessionId']
    prefix = '/session/' + session
    wait_for(lambda: execute('return typeof window.__TAURI__?.core?.invoke==="function" && !!document.getElementById("movie-wall")?.contentDocument?.body'),
             bool, 'Native Studio and its iframe did not load', 15)
    require(execute('return location.pathname') in ('/studio', '/studio/'), 'Unexpected native application entry')
    install_guard()
    identity = native()
    app_pid, xid = identity.get('pid'), identity.get('native_xid')
    require(isinstance(app_pid, int) and app_pid > 0 and isinstance(xid, int) and xid > 0,
            'Native state must identify its PID and top-level XID')
    require(Path('/proc', str(app_pid), 'exe').resolve(strict=True) == TEST_BINARY.resolve(),
            'Native state does not belong to the isolated executable')
    app_start_time = Path('/proc', str(app_pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]
    require(profile_environment(app_pid) == driver_profile, 'App did not inherit the private driver profile')
    require(window_properties(xid)['pid'] == app_pid, 'Native X11 window belongs to another process')
    REPORT['private_application_profile_verified'] = True
    REPORT['test_identity'] = {'pid': app_pid, 'native_xid': xid}
    capability = identity.get('transparency', {})
    REPORT['native_transparency_capability'] = capability
    surface = x11_surface(xid)
    REPORT['independent_x11_surface'] = surface
    require(all(capability.get(key) is True for key in
                ('requested', 'rgba_visual_available', 'rgba_visual', 'composited', 'available'))
            and capability.get('visual_depth') == 32 and surface['depth'] == 32,
            'Native capability and independent X11 RGBA depth do not agree')
    require(surface['whole_window_opacity'] in (None, [0xffffffff]),
            'Whole-window opacity would also fade posters and text')
    require(not identity['fullscreen'], 'Isolated app unexpectedly opened fullscreen')
    if identity['maximized']:
        native('maximize')
        wait_for(native, lambda state: not state['maximized'], 'Initial native restore failed')
    focus()
    monitor = window_monitor_work_area(xinfo(xid), REPORT['wm']['work_area'])
    REPORT['monitor'] = monitor
    work, scale = monitor['work_area'], float(identity['scale_factor'])
    require(math.isfinite(scale) and scale > 0, 'Native scale factor is invalid')
    width, height = min(round(1180 * scale), work['width'] - 100), min(round(800 * scale), work['height'] - 100)
    require(width >= 960 * scale and height >= 640 * scale, 'Monitor is too small for the controlled glass proof')
    run(['/usr/bin/xdotool', 'windowsize', str(xid), str(width), str(height)])
    run(['/usr/bin/xdotool', 'windowmove', str(xid), str(work['x'] + 40), str(work['y'] + 40)])
    wait_for(lambda: xinfo(xid), lambda state: state['width'] == width and state['height'] == height,
             'Native geometry did not settle')
    baseline = filled_snapshot('baseline_full_frame')
    require(baseline['native']['decorated'] is False, 'App still requests system decorations')
    geometry = baseline['x11']
    ancestors = outer_ancestor(xid)
    outer_xid = ancestors[-1]['xid']
    require(all(abs(ancestors[-1][key] - geometry[key]) <= 1 for key in ('x', 'y', 'width', 'height')),
            'Outer native frame differs from its client rectangle')
    REPORT['owned_outer_ancestry'] = ancestors

    backdrop = Gtk.Window(type=Gtk.WindowType.POPUP)
    backdrop.set_title('Movie Night private glass verification backdrop')
    backdrop.set_decorated(False)
    backdrop.set_accept_focus(False)
    backdrop.set_focus_on_map(False)
    backdrop.set_skip_taskbar_hint(True)
    backdrop.set_skip_pager_hint(True)
    backdrop.set_visual(backdrop.get_screen().get_system_visual())
    backdrop_box = Gtk.EventBox()
    backdrop.add(backdrop_box)
    backdrop_scale = backdrop.get_scale_factor()
    backdrop.move((geometry['x'] - 32) // backdrop_scale, (geometry['y'] - 32) // backdrop_scale)
    backdrop.resize(math.ceil((geometry['width'] + 64) / backdrop_scale), math.ceil((geometry['height'] + 64) / backdrop_scale))
    backdrop.show_all()
    pump(0.2)
    backdrop_xid = int(GdkX11.X11Window.get_xid(backdrop.get_window()))
    require(window_properties(backdrop_xid)['pid'] == os.getpid(), 'GTK backdrop lacks exact owned PID identity')
    background_geometry = xinfo(backdrop_xid)
    require(background_geometry['mapped'] and background_geometry['x'] <= geometry['x'] - 28
            and background_geometry['y'] <= geometry['y'] - 28
            and background_geometry['x'] + background_geometry['width'] >= geometry['x'] + geometry['width']
            and background_geometry['y'] + background_geometry['height'] >= geometry['y'] + geometry['height'],
            'Owned backdrop does not cover the complete application rectangle')
    REPORT['owned_backdrop'] = {'pid': os.getpid(), 'xid': backdrop_xid, 'geometry': background_geometry,
                                'accept_focus': backdrop.get_accept_focus(), 'focus_on_map': backdrop.get_focus_on_map()}
    focus()
    connection.stack_owned_pair(outer_xid, backdrop_xid)
    pump(0.4)
    set_material('glass')
    regions = sample_regions()
    REPORT['sample_contract'] = regions
    require(regions['samples']['chrome'] and regions['samples']['wall_background'],
            'Cannot find genuine blank chrome and wall background samples')
    require(all(row['opacity'] == '1' for row in regions['opacity_chain']),
            'An ancestor opacity would fade the opaque content control')
    physical_samples = {name: {key: round(value * scale) for key, value in region.items()}
                        for name, region in regions['samples'].items() if region}
    REPORT['physical_samples_in_owned_capture'] = physical_samples
    # Place the pointer away from poster/chrome samples. No click or key is sent.
    run(['/usr/bin/xdotool', 'mousemove', '--sync', str(geometry['x'] + geometry['width'] - 8),
         str(geometry['y'] + geometry['height'] - 8)])
    observations = {}
    for mode in ('glass', 'solid'):
        set_material(mode)
        black = capture(mode, 'black')
        white = capture(mode, 'white')
        repeated_black = capture(mode, 'black-repeat')
        observations[mode] = {name: {'backdrop_change': compare(black[name], white[name]),
                                    'black_repeat': compare(black[name], repeated_black[name])}
                              for name in physical_samples}
    REPORT['pixel_comparisons'] = observations
    REPORT['thresholds'] = {'glass_min_channel_delta': 8, 'stable_mean_absolute_delta': 1.5,
                             'opaque_max_absolute_delta': 3, 'opaque_expected_rgb_tolerance': 3}
    for mode, items in observations.items():
        for name, item in items.items():
            require(item['black_repeat']['mean_absolute_delta'] <= 1.5,
                    'Page/compositor changed over time at ' + mode + '/' + name)
            delta = item['backdrop_change']
            if mode == 'glass' and name in ('chrome', 'wall_background'):
                require(min(delta['signed_delta_rgb']) >= 8,
                        'Glass does not reveal the controlled backdrop at ' + name)
            else:
                require(delta['mean_absolute_delta'] <= 1.5 and delta['max_absolute_delta'] <= 3,
                        'An opaque/solid surface changes with the backdrop at ' + mode + '/' + name)
        opaque = items['opaque_control']['backdrop_change']
        for value in (opaque['first_rgb'], opaque['second_rgb']):
            require(all(abs(actual - expected) <= 3 for actual, expected in zip(value, (34, 119, 204))),
                    'Opaque control is faded, occluded, or incorrectly sampled')
    guards = dom_state()['guards']
    REPORT['network_guards'] = guards
    require(guards['parent'] and guards['child'] and guards['blockedWrites'] == 0,
            'A verification guard was lost or an API write was attempted')
    require(not (TEST_RUNTIME / 'player.sock').exists() and not (TEST_RUNTIME / 'embed-window.json').exists(),
            'Glass verification unexpectedly prepared a media artifact')
    REPORT['no_media_artifacts'] = True
    REPORT['pass'] = True
except Blocked as error:
    REPORT['blocked'], REPORT['error'] = True, safe_error(error)
except Exception as error:
    REPORT['error'] = safe_error(error)
    if xid and test_process_alive():
        for name, read in (('failure_dom', dom_state), ('failure_native', native), ('failure_x11', lambda: x11_surface(xid))):
            try:
                REPORT[name] = read()
            except Exception as diagnostic_error:
                REPORT[name + '_error'] = safe_error(diagnostic_error)
finally:
    if backdrop is not None:
        backdrop.destroy()
        try:
            pump(0.1)
        except Exception:
            pass
        owned_xid = globals().get('backdrop_xid')
        if owned_xid:
            try:
                destroyed = run(['/usr/bin/xwininfo', '-id', str(owned_xid)], check=False).returncode != 0
                REPORT['owned_backdrop_destroyed'] = destroyed
                if not destroyed:
                    REPORT['pass'] = False
                    REPORT['cleanup_error'] = 'Owned GTK backdrop still has a live XID'
            except Exception as cleanup_error:
                REPORT['pass'] = False
                REPORT['cleanup_error'] = safe_error(cleanup_error)
    if connection is not None:
        connection.close()
    if session:
        try:
            http('/session/' + session, method='DELETE')
        except Exception:
            pass
    if test_process_alive():
        os.kill(app_pid, signal.SIGTERM)
        REPORT['cleanup_terminated_test_process'] = True
    if runtime_validated:
        target = TEST_RUNTIME / 'native-glass-verification.json'
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, 'w') as handle:
            json.dump(REPORT, handle, indent=2)
            handle.write('\n')
        target.chmod(0o600)
    print(json.dumps(REPORT))
    raise SystemExit(0 if REPORT['pass'] else 2 if REPORT.get('blocked') else 1)
