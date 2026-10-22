use gtk::glib::translate::ToGlibPtr;
use gtk::prelude::*;
use serde::Serialize;
use serde_json::Value;
use std::cell::RefCell;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::os::raw::c_ulong;
use std::os::unix::fs::{FileTypeExt, MetadataExt, OpenOptionsExt, PermissionsExt};
use std::os::unix::net::UnixStream;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tokio::sync::oneshot;

const FRONTEND: &str = "http://127.0.0.1:8789/studio";
const RUNTIME: &str = "/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime";
const EMBED_RECEIPT: &str = "embed-window.json";
const PLAYER_SOCKET: &str = "player.sock";
const MAX_VIEWPORT_COORDINATE: f64 = 1_000_000.0;

#[link(name = "gdk-3")]
extern "C" {
    fn gdk_x11_window_get_xid(window: *mut gdk::ffi::GdkWindow) -> c_ulong;
}
extern "C" {
    fn geteuid() -> u32;
}

#[derive(Clone, Copy, Default)]
struct MovieViewport {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
}

#[derive(Serialize)]
struct MovieViewportState {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    visible: bool,
    active: bool,
    scale_factor: i32,
}

// The Studio frame is the chrome for this OS window. Its controls must never
// resize, hide or close an imitation window inside the WebView.
#[derive(Serialize)]
struct MovieWindowState {
    pid: u32,
    native_xid: u64,
    maximized: bool,
    fullscreen: bool,
    minimized: bool,
    decorated: bool,
    focused: bool,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    scale_factor: f64,
    transparency: MovieTransparencyState,
}

// Capability readback, not proof of the final composited pixels. The Studio
// page can offer glass only when this native surface actually uses the screen's
// RGBA visual and an X11 compositing manager is present.
#[derive(Serialize)]
struct MovieTransparencyState {
    requested: bool,
    rgba_visual_available: bool,
    rgba_visual: bool,
    visual_depth: i32,
    composited: bool,
    available: bool,
}

fn movie_window_state(window: &WebviewWindow) -> Result<MovieWindowState, String> {
    let native = window.gtk_window().map_err(|_| "Native window unavailable")?;
    let gdk_window = native.window().ok_or("Native window is not realized")?;
    if !gdk_window.type_().name().contains("X11") {
        return Err("Movie Night's native frame needs the X11 desktop session".into());
    }
    let native_xid = unsafe { gdk_x11_window_get_xid(gdk_window.to_glib_none().0) as u64 };
    let size = window.inner_size().map_err(|_| "Native size unavailable")?;
    let position = window.outer_position().map_err(|_| "Native position unavailable")?;
    let screen = gdk_window.screen();
    let visual = gdk_window.visual();
    let rgba_visual = screen.rgba_visual();
    let uses_rgba_visual = rgba_visual.as_ref().is_some_and(|rgba| rgba == &visual);
    let composited = screen.is_composited();
    Ok(MovieWindowState {
        pid: std::process::id(), native_xid,
        maximized: window.is_maximized().map_err(|_| "Native state unavailable")?,
        fullscreen: window.is_fullscreen().map_err(|_| "Native state unavailable")?,
        minimized: window.is_minimized().map_err(|_| "Native state unavailable")?,
        decorated: window.is_decorated().map_err(|_| "Native state unavailable")?,
        focused: window.is_focused().map_err(|_| "Native state unavailable")?,
        width: size.width, height: size.height, x: position.x, y: position.y,
        scale_factor: window.scale_factor().map_err(|_| "Native scale unavailable")?,
        transparency: MovieTransparencyState {
            requested: true,
            rgba_visual_available: rgba_visual.is_some(),
            rgba_visual: uses_rgba_visual,
            visual_depth: visual.depth(),
            composited,
            available: uses_rgba_visual && composited,
        },
    })
}

fn sync_window_state(window: &WebviewWindow) {
    if let Ok(state) = movie_window_state(window) {
        if let Ok(value) = serde_json::to_string(&state) {
            let _ = window.eval(&format!(
                "window.__MOVIE_NIGHT_WINDOW_STATE__={value};if(typeof window.movieNightNativeWindowState==='function')window.movieNightNativeWindowState({value});"
            ));
        }
    }
}

#[tauri::command]
async fn native_movie_window(
    window: WebviewWindow,
    action: String,
    direction: Option<String>,
) -> Result<MovieWindowState, String> {
    // A closed vocabulary, caller-origin authorization, and this exact window
    // only. The content iframe is not given this command by the shell bridge.
    on_main(window, move |window| {
        match action.as_str() {
            "state" => {},
            "drag" => {
                if !window.is_fullscreen().map_err(|_| "Native state unavailable")? {
                    window.start_dragging().map_err(|_| "Window dragging unavailable")?;
                }
            },
            "resize" => {
                let variant = match direction.as_deref() {
                    Some("left") => "West",
                    Some("right") => "East",
                    Some("top") => "North",
                    Some("bottom") => "South",
                    Some("left-top") => "NorthWest",
                    Some("right-top") => "NorthEast",
                    Some("left-bottom") => "SouthWest",
                    Some("right-bottom") => "SouthEast",
                    _ => return Err("Invalid native resize edge".into()),
                };
                if !window.is_maximized().map_err(|_| "Native state unavailable")?
                    && !window.is_fullscreen().map_err(|_| "Native state unavailable")? {
                    let webview: &tauri::Webview = window.as_ref();
                    // Tauri 2.11 exposes the operation but not a root re-export
                    // of its direction enum. Infer that public argument type
                    // from these fixed variants without adding a dependency.
                    let edge = serde_json::from_value(Value::String(variant.into()))
                        .map_err(|_| "Invalid native resize edge")?;
                    webview.window().start_resize_dragging(edge)
                        .map_err(|_| "Window resizing unavailable")?;
                }
            },
            "minimize" => window.minimize().map_err(|_| "Window minimize unavailable")?,
            "maximize" => {
                if window.is_fullscreen().map_err(|_| "Native state unavailable")? {
                    window.set_fullscreen(false).map_err(|_| "Window restore unavailable")?;
                } else if window.is_maximized().map_err(|_| "Native state unavailable")? {
                    window.unmaximize().map_err(|_| "Window restore unavailable")?;
                } else {
                    window.maximize().map_err(|_| "Window maximize unavailable")?;
                }
            },
            "focus" => window.set_focus().map_err(|_| "Window focus unavailable")?,
            // close() enters the existing child-player shutdown handshake.
            "close" => window.close().map_err(|_| "Window close unavailable")?,
            _ => return Err("Unsupported native window action".into()),
        }
        movie_window_state(window)
    }).await
}

// GTK objects never enter Tauri's Send + Sync application state.
struct NativeHost {
    overlay: gtk::Overlay,
    video: gtk::DrawingArea,
    viewport: MovieViewport,
    active: bool,
    xid: Option<u64>,
    created_at_unix_ms: u64,
}

thread_local! {
    static HOST: RefCell<Option<NativeHost>> = const { RefCell::new(None) };
}

#[derive(Serialize)]
struct EmbedReceipt {
    schema: &'static str,
    xid: u64,
    pid: u32,
    created_at_unix_ms: u64,
    updated_at_unix_ms: u64,
    backend: &'static str,
    window_label: &'static str,
}

fn timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn local_url(url: &tauri::Url) -> bool {
    url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.port_or_known_default() == Some(8789)
        && url.username().is_empty()
        && url.password().is_none()
}

fn authorize(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" || !local_url(&window.url().map_err(|_| "Window unavailable")?) {
        return Err("This command is available only in Movie Night.".into());
    }
    Ok(())
}

async fn on_main<T, F>(window: WebviewWindow, action: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&WebviewWindow) -> Result<T, String> + Send + 'static,
{
    authorize(&window)?;
    let (send, receive) = oneshot::channel();
    let native_window = window.clone();
    window
        .run_on_main_thread(move || {
            let result = authorize(&native_window).and_then(|_| action(&native_window));
            let _ = send.send(result);
        })
        .map_err(|_| "The native window is unavailable.")?;
    receive.await.map_err(|_| "The native window closed.".to_owned())?
}

fn initialize_host(window: &WebviewWindow) -> Result<(), String> {
    let native_window = window.gtk_window().map_err(|_| "GTK window unavailable")?;
    let container = window.default_vbox().map_err(|_| "GTK container unavailable")?;
    let web_children = container.children();
    if web_children.len() != 1 || !web_children[0].type_().name().contains("WebKitWebView") {
        return Err("Movie Night needs its single native webview.".into());
    }
    // Tauri 2.11's Linux mouse/touch resize callbacks require the WebView's
    // grandparent to remain GtkWindow. Keep exactly Window -> Overlay -> WebView;
    // wrapping the WebView in another Box would abort on an ordinary click.
    // This private host has one WebView and no native menu or child WebViews.
    let content = web_children[0].clone();
    content.set_hexpand(true);
    content.set_vexpand(true);
    container.remove(&content);
    native_window.remove(&container);
    let overlay = gtk::Overlay::new();
    overlay.set_widget_name("movie-night-overlay");
    overlay.set_hexpand(true);
    overlay.set_vexpand(true);
    overlay.add(&content);
    native_window.add(&overlay);

    let video = gtk::DrawingArea::new();
    video.set_widget_name("movie-night-video");
    video.set_direction(gtk::TextDirection::Ltr);
    video.set_halign(gtk::Align::Start);
    video.set_valign(gtk::Align::Start);
    video.set_hexpand(false);
    video.set_vexpand(false);
    video.set_size_request(1, 1);
    video.set_can_focus(false);
    video.set_no_show_all(true);
    let css = gtk::CssProvider::new();
    css.load_from_data(b"#movie-night-overlay { background-color: transparent; background-image: none; }\n#movie-night-video { background-color: #000000; }")
        .map_err(|_| "Native video style unavailable")?;
    overlay
        .style_context()
        .add_provider(&css, gtk::STYLE_PROVIDER_PRIORITY_APPLICATION);
    video
        .style_context()
        .add_provider(&css, gtk::STYLE_PROVIDER_PRIORITY_APPLICATION);
    overlay.add_overlay(&video);
    overlay.set_overlay_pass_through(&video, true);
    video.hide();
    overlay.connect_size_allocate(|_, _| { let _ = apply_viewport(); });
    HOST.with(|state| {
        *state.borrow_mut() = Some(NativeHost {
            overlay: overlay.clone(),
            video,
            viewport: MovieViewport::default(),
            active: false,
            xid: None,
            created_at_unix_ms: timestamp_ms(),
        });
    });
    content.show();
    overlay.show();
    Ok(())
}

fn clipped_viewport(viewport: MovieViewport, width: i32, height: i32) -> (i32, i32, i32, i32) {
    let bound_width = f64::from(width.max(0));
    let bound_height = f64::from(height.max(0));
    // Round inwards so a fractional DOM edge never paints over frame chrome.
    // GTK allocation coordinates are logical pixels. GTK/GDK applies its scale
    // factor when positioning the X11 windows; multiplying by devicePixelRatio
    // here would scale the rectangle twice on a high-density display.
    let left = viewport.x.clamp(0.0, bound_width).ceil() as i32;
    let top = viewport.y.clamp(0.0, bound_height).ceil() as i32;
    let right = (viewport.x + viewport.width).clamp(0.0, bound_width).floor() as i32;
    let bottom = (viewport.y + viewport.height).clamp(0.0, bound_height).floor() as i32;
    (left, top, (right - left).max(0), (bottom - top).max(0))
}

fn apply_viewport() -> Option<MovieViewportState> {
    // No thread-local borrow is held while GTK emits allocation/map signals.
    let layout = HOST.with(|state| {
        let state = state.try_borrow().ok()?;
        let host = state.as_ref()?;
        Some((host.overlay.clone(), host.video.clone(), host.viewport, host.active))
    });
    let (overlay, video, viewport, active) = layout?;
    let (x, y, width, height) = clipped_viewport(
        viewport, overlay.allocated_width(), overlay.allocated_height(),
    );
    // A DrawingArea has no content requisition. START alignment, explicit size
    // and margins give GtkOverlay this exact rectangle without resizing its
    // main WebView child. GTK also clips its overlay window to these bounds.
    if video.margin_start() != x { video.set_margin_start(x); }
    if video.margin_top() != y { video.set_margin_top(y); }
    if video.width_request() != width.max(1) || video.height_request() != height.max(1) {
        video.set_size_request(width.max(1), height.max(1));
    }
    let visible = active && viewport.visible && width > 0 && height > 0;
    if visible != video.get_visible() {
        if visible { video.show(); } else { video.hide(); }
    }
    Some(MovieViewportState {
        x, y, width, height, visible, active,
        scale_factor: overlay.scale_factor().max(1),
    })
}

fn set_mode(window: &WebviewWindow, active: bool) -> Result<(), String> {
    HOST.with(|state| {
        let mut state = state.borrow_mut();
        let host = state.as_mut().ok_or("Native video host unavailable")?;
        host.active = active;
        Ok::<(), String>(())
    })?;
    apply_viewport().ok_or("Native video layout unavailable")?;
    sync_frontend(window, active);
    Ok(())
}

fn sync_frontend(window: &WebviewWindow, active: bool) {
    let flag = if active { "true" } else { "false" };
    let _ = window.eval(&format!(
        "window.__MOVIE_NIGHT_NATIVE_ACTIVE__={flag};if(typeof window.movieNightNativeMode==='function')window.movieNightNativeMode({flag});"
    ));
    if let Ok(fullscreen) = window.is_fullscreen() {
        let _ = window.eval(&format!(
            "if(typeof window.movieNightNativeFullscreen==='function')window.movieNightNativeFullscreen({fullscreen});"
        ));
    }
}

fn private_runtime() -> Result<&'static Path, String> {
    let directory = Path::new(RUNTIME);
    if !directory.exists() {
        fs::create_dir_all(directory).map_err(|_| "Movie Night runtime unavailable")?;
        fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Movie Night runtime privacy could not be set")?;
    }
    let metadata = fs::symlink_metadata(directory).map_err(|_| "Movie Night runtime unavailable")?;
    if !metadata.is_dir()
        || metadata.file_type().is_symlink()
        || metadata.uid() != unsafe { geteuid() }
        || metadata.mode() & 0o077 != 0
    {
        return Err("Movie Night needs its own private runtime directory.".into());
    }
    Ok(directory)
}

fn write_embed_receipt(xid: u64, created_at_unix_ms: u64) -> Result<(), String> {
    let directory = private_runtime()?;
    let stamp = timestamp_ms();
    let temporary = directory.join(format!("embed-window.{}.{}.tmp", std::process::id(), stamp));
    let destination = directory.join(EMBED_RECEIPT);
    let receipt = EmbedReceipt {
        schema: "movie-night.embed-window/v1",
        xid,
        pid: std::process::id(),
        created_at_unix_ms,
        updated_at_unix_ms: stamp,
        backend: "x11",
        window_label: "main",
    };
    let result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true).mode(0o600).open(&temporary)?;
        serde_json::to_writer(&mut file, &receipt).map_err(std::io::Error::other)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        fs::rename(&temporary, &destination)?;
        File::open(directory)?.sync_all()
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
        return Err("Could not prepare the native player connection.".into());
    }
    Ok(())
}

#[tauri::command]
async fn prepare_movie_player(window: WebviewWindow) -> Result<bool, String> {
    on_main(window, |window| {
        // Preparation only gives a future player a stable hidden native parent.
        // It never activates player mode or adopts an existing standalone film.
        apply_viewport().ok_or("Native video layout unavailable")?;
        let receipt = HOST.with(|state| {
            let mut state = state.borrow_mut();
            let host = state.as_mut().ok_or("Native video host unavailable")?;
            host.video.realize();
            let native = host.video.window().ok_or("Native video window could not be realized")?;
            if !native.type_().name().contains("X11") {
                return Err("The native movie window currently requires X11.".to_owned());
            }
            let xid = unsafe { gdk_x11_window_get_xid(native.to_glib_none().0) } as u64;
            if xid == 0 {
                return Err("Native video window has no X11 ID.".to_owned());
            }
            host.xid = Some(xid);
            Ok((xid, host.created_at_unix_ms))
        });
        let (xid, created_at) = match receipt {
            Ok(value) => value,
            Err(error) => {
                let _ = set_mode(window, false);
                return Err(error);
            }
        };
        if let Err(error) = write_embed_receipt(xid, created_at) {
            let _ = set_mode(window, false);
            return Err(error);
        }
        Ok(true)
    }).await
}

#[tauri::command]
async fn show_movie_player(window: WebviewWindow) -> Result<bool, String> {
    let xid = on_main(window.clone(), |_| {
        Ok(HOST.with(|state| state.borrow().as_ref().and_then(|host| host.xid)))
    }).await?;
    if xid.is_none() {
        // A paused/playing standalone session has no video inside this host.
        return Ok(false);
    }
    let attached = tauri::async_runtime::spawn_blocking(move || {
        embedded_connection(xid).map(|connection| connection.is_some())
    }).await.map_err(|_| "Player connection unavailable.")?
        .map_err(|_| "Could not confirm the native player connection.")?;
    if !attached {
        return Ok(false);
    }
    on_main(window, |window| {
        set_mode(window, true)?;
        window.show().map_err(|_| "Movie window unavailable")?;
        window.set_focus().map_err(|_| "Movie window could not receive focus")?;
        Ok(true)
    }).await
}

#[tauri::command]
async fn show_movie_wall(window: WebviewWindow) -> Result<bool, String> {
    on_main(window, |window| {
        set_mode(window, false)?;
        Ok(true)
    }).await
}

#[tauri::command]
async fn toggle_movie_fullscreen(window: WebviewWindow) -> Result<bool, String> {
    on_main(window, |window| {
        let fullscreen = !window.is_fullscreen().map_err(|_| "Window state unavailable")?;
        window.set_fullscreen(fullscreen).map_err(|_| "Fullscreen unavailable")?;
        let _ = window.eval(&format!(
            "if(typeof window.movieNightNativeFullscreen==='function')window.movieNightNativeFullscreen({fullscreen});"
        ));
        Ok(fullscreen)
    }).await
}

#[tauri::command]
async fn set_movie_controls_height(window: WebviewWindow, height: f64) -> Result<bool, String> {
    if !height.is_finite() {
        return Err("Invalid controls height.".into());
    }
    // Compatibility with the existing wall bridge. Studio now owns the full
    // content layout; its measured viewport replaces the former controls strip.
    // No legacy strip fallback: this command never shrinks the Studio WebView.
    on_main(window, |_| {
        HOST.with(|state| {
            if state.borrow().is_none() { Err("Native video host unavailable") } else { Ok(()) }
        })?;
        Ok(true)
    }).await
}

#[tauri::command]
async fn set_movie_viewport(
    window: WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
) -> Result<MovieViewportState, String> {
    if [x, y, width, height].iter().any(|value| !value.is_finite() || value.abs() > MAX_VIEWPORT_COORDINATE)
        || width < 0.0 || height < 0.0
    {
        return Err("Invalid movie viewport.".into());
    }
    on_main(window, move |_| {
        HOST.with(|state| {
            let mut state = state.borrow_mut();
            let host = state.as_mut().ok_or("Native video host unavailable")?;
            host.viewport = MovieViewport { x, y, width, height, visible };
            Ok::<(), String>(())
        })?;
        // Geometry/visibility only. Only show_movie_player may set active=true,
        // after its existing read-only mpv-parent ownership check succeeds.
        apply_viewport().ok_or_else(|| "Native video layout unavailable".to_owned())
    }).await
}

fn remove_own_receipt() {
    let path = Path::new(RUNTIME).join(EMBED_RECEIPT);
    let Ok(bytes) = fs::read(&path) else { return };
    let Ok(receipt) = serde_json::from_slice::<Value>(&bytes) else { return };
    if receipt.get("pid").and_then(Value::as_u64) == Some(std::process::id() as u64) {
        let _ = fs::remove_file(path);
    }
}

fn read_ipc_line(reader: &mut BufReader<UnixStream>) -> Result<Option<Value>, ()> {
    let mut bytes = Vec::new();
    let count = reader.take(65_537).read_until(b'\n', &mut bytes).map_err(|_| ())?;
    if count == 0 { return Ok(None); }
    if count > 65_536 || bytes.last() != Some(&b'\n') { return Err(()); }
    serde_json::from_slice(&bytes).map(Some).map_err(|_| ())
}

// Read-only identity check; never adopts or changes a standalone player's state.
fn embedded_connection(xid: Option<u64>) -> Result<Option<(UnixStream, BufReader<UnixStream>)>, ()> {
    let Some(xid) = xid else { return Ok(None) };
    let path = Path::new(RUNTIME).join(PLAYER_SOCKET);
    let metadata = match fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(()),
    };
    if !metadata.file_type().is_socket() || metadata.uid() != unsafe { geteuid() } {
        return Err(());
    }
    let mut stream = match UnixStream::connect(&path) {
        Ok(stream) => stream,
        Err(error) if matches!(error.kind(), std::io::ErrorKind::NotFound | std::io::ErrorKind::ConnectionRefused) => return Ok(None),
        Err(_) => return Err(()),
    };
    stream.set_read_timeout(Some(Duration::from_secs(2))).map_err(|_| ())?;
    stream.set_write_timeout(Some(Duration::from_secs(2))).map_err(|_| ())?;
    stream.write_all(b"{\"command\":[\"get_property\",\"wid\"],\"request_id\":7101}\n").map_err(|_| ())?;
    let mut reader = BufReader::new(stream.try_clone().map_err(|_| ())?);
    let deadline = Instant::now() + Duration::from_secs(3);
    let matches_parent = loop {
        if Instant::now() >= deadline { return Err(()); }
        let Some(value) = read_ipc_line(&mut reader)? else { return Ok(None) };
        if value.get("request_id").and_then(Value::as_u64) != Some(7101) { continue; }
        if value.get("error").and_then(Value::as_str) != Some("success") { return Err(()); }
        let id = value.get("data").and_then(|value| {
            value.as_u64().or_else(|| value.as_str().and_then(|text| text.parse::<u64>().ok()))
        });
        break id == Some(xid);
    };
    if !matches_parent {
        // Existing standalone mpv, or another host: leave it completely alone.
        return Ok(None);
    }
    Ok(Some((stream, reader)))
}

// The only playback-changing operation in the shell: explicit window close,
// after confirming that this exact native parent owns the mpv child window.
fn quit_embedded_player(xid: Option<u64>) -> Result<(), ()> {
    let Some((mut stream, mut reader)) = embedded_connection(xid)? else { return Ok(()) };
    stream.write_all(b"{\"command\":[\"quit\"],\"request_id\":7102}\n").map_err(|_| ())?;
    let deadline = Instant::now() + Duration::from_secs(4);
    loop {
        if Instant::now() >= deadline { return Err(()); }
        if read_ipc_line(&mut reader)?.is_none() { return Ok(()); }
    }
}

fn install_close_handler(window: &WebviewWindow) {
    let closing = Arc::new(AtomicBool::new(false));
    let native_window = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if closing.swap(true, Ordering::SeqCst) { return; }
            let xid = HOST.with(|state| state.borrow().as_ref().and_then(|host| host.xid));
            let native_window = native_window.clone();
            let closing = closing.clone();
            std::thread::spawn(move || {
                let result = quit_embedded_player(xid);
                let callback_window = native_window.clone();
                let _ = native_window.run_on_main_thread(move || {
                    if result.is_ok() {
                        remove_own_receipt();
                        let _ = callback_window.destroy();
                    } else {
                        closing.store(false, Ordering::SeqCst);
                        let _ = callback_window.eval(
                            "window.alert('Movie Night could not safely close the embedded player. Please stop the film and close the window again.');"
                        );
                    }
                });
            });
        }
    });
}

pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            prepare_movie_player,
            show_movie_player,
            show_movie_wall,
            toggle_movie_fullscreen,
            set_movie_controls_height,
            set_movie_viewport,
            native_movie_window
        ])
        .setup(|app| {
            if let Some(settings) = gtk::Settings::default() {
                settings.set_gtk_application_prefer_dark_theme(true);
            }
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(FRONTEND.parse()?))
                .title("Movie Night")
                .theme(Some(tauri::Theme::Dark))
                // Tao 0.35 maps a visible GTK window before applying decoration
                // attributes. Keep it hidden until the undecorated host is
                // complete, so Mutter never allocates a temporary title bar.
                .visible(false)
                .decorations(false)
                // Per-pixel alpha keeps text, posters and the native video
                // opaque while Studio's painted surfaces can reveal desktop
                // content. Never lower the whole native window's opacity.
                .transparent(true)
                .background_color(tauri::utils::config::Color(0, 0, 0, 0))
                .inner_size(1280.0, 800.0)
                .min_inner_size(760.0, 540.0)
                .resizable(true)
                .initialization_script("window.__MOVIE_NIGHT_NATIVE__=true;window.__MOVIE_NIGHT_NATIVE_ACTIVE__=false;window.__MOVIE_NIGHT_VIEWPORT__=true;")
                .on_navigation(local_url)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_download(|_, _| false)
                .on_page_load(|window, payload| {
                    if payload.event() == PageLoadEvent::Finished {
                        let callback_window = window.clone();
                        let _ = window.run_on_main_thread(move || {
                            let active = HOST.with(|state| state.borrow().as_ref().is_some_and(|host| host.active));
                            sync_frontend(&callback_window, active);
                            sync_window_state(&callback_window);
                        });
                    }
                })
                .build()?;
            initialize_host(&window).map_err(std::io::Error::other)?;
            install_close_handler(&window);
            let observed_window = window.clone();
            window.on_window_event(move |event| {
                if matches!(event, WindowEvent::Resized(_) | WindowEvent::Moved(_) | WindowEvent::Focused(_) | WindowEvent::ScaleFactorChanged { .. }) {
                    sync_window_state(&observed_window);
                }
            });
            window.show()?;
            window.set_focus()?;
            Ok(())
        })
        .run(tauri::generate_context!())
}
