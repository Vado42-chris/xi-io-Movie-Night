# Movie Night native application

An independent Linux/X11 Tauri 2 application whose actual native window uses Studio's `WindowFrame` as its custom chrome, with a native video area and Movie Night's HTML controls. Its identifier is `personal.movienight.desktop`. It does not modify the existing Studio/Inbox installation, read provider settings, or start media on launch.

**Revision status:** target native-window and synthetic-surface verification passed on Aries. The verified production binary was installed and reopened through the existing launcher at 2026-10-22 06:38 UTC, with the wall visually checked and playback idle. See [deployment receipt](../verification/native-window-deployment.json).

The application opens `http://127.0.0.1:8789/studio` with native decorations disabled and a dark GTK/Tauri theme. The existing Studio frame fills the whole client area; there is no extra desktop heading, inner floating Movie Night window, or simulated taskbar in native mode. Its title/rail drag regions move the OS window, its eight resize handles resize the OS window, and its minimize/maximize/restore/close controls act on that same window.

The frame source comes from `Vado42-chris/xi-io-studio` at **`94c49141a132ed00cdd72d0457911fc40523794f`**. A small local `nativeWindow` adapter in the vendored component preserves the frame's rendering while disabling its internal Framer drag/size/maximize ownership in the native host. Its action callbacks use the host's bounded `native_movie_window` command and actual window-state reports. The ordinary browser presentation retains the frame's desktop behavior when that adapter is absent. This is a local consumer patch, not a change to the managed Studio checkout.

The frame wraps the existing wall at `/?studio=1`; the iframe keeps its playback controls and receives the playback bridge from its same-origin parent. Missing vendor dependencies have qualified-checkout donors; the frame pin is not a claim that every dependency came from that commit. See [../studio-shell/src/main.jsx](../studio-shell/src/main.jsx) and the [local WindowFrame adapter](../studio-shell/vendor/src/components/desktop/WindowFrame.jsx).

## Startup and native input

Keep `.visible(false)` alongside `.decorations(false)` during construction. Initialize the GTK Overlay and close/state handlers before the first `window.show()`. The pinned Tao 0.35.3 constructor otherwise shows a visible GTK window before applying its decoration attribute; the observed GNOME startup left a 37-pixel frame-extents/geometry discrepancy. Hidden construction applies the undecorated setting before the first map. Do not replace this ordering with a repeated post-map decoration call or a hardcoded size correction. See [native startup](src/native.rs) and the [pinned Tao constructor](https://github.com/tauri-apps/tao/blob/tao-v0.35.3/src/platform_impl/linux/window.rs).

Native mouse drag and resize start from `onMouseDown`. After the window manager takes a native pointer grab, WebKitGTK can miss the corresponding `pointerup` and omit the next `pointerdown` even though it still delivers a trusted `mousedown`. The native adapter therefore uses `onPointerDown` only for non-mouse input and prevents its compatibility mouse event from starting a duplicate operation. The ordinary browser/Framer path is unchanged. The actual OS drag → resize → drag sequence passed on Aries; retain that sequence in future native regressions. Native touch/pen gestures remain unverified. Implementation: [WindowFrame native input adapter](../studio-shell/vendor/src/components/desktop/WindowFrame.jsx).

## Native video viewport

The full Studio WebView is the direct main child of a **GTK Overlay**, which is the direct child of the GTK window. This preserves Tauri 2.11’s required WebView grandparent for native mouse/touch handling. A dedicated GTK DrawingArea is its native video overlay. The shell measures the wall's `#native-video-placeholder` inside the iframe and calls `set_movie_viewport` with its coordinates in the top-level client area. Native dragging moves the window and video child together; resizing updates the measured content rectangle. The host validates and clips that rectangle to its allocation, reports its scale factor, and shows it only while the matching player is active and the requested viewport is visible. DOM geometry uses logical client coordinates, not the native state's physical screen position.

The WebView stays full-size. There is no legacy bottom-strip fallback, and `set_movie_controls_height` no longer shrinks or repacks the Studio page. Native minimize lets the window manager hide the application and its child; it does not pause playback. Returning to the wall or showing a narrow-layout concierge over the content hides the video rectangle without reloading media. These presentation changes may leave audio running. Closing the native frame uses the separate shutdown handshake below. External navigation, new windows, and downloads remain denied by the native host. Source: [src/native.rs](src/native.rs).

## Open the wall once

The installed binary must be exactly:

```text
/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime/bin/movie-night-desktop
```

The adapter checks this exact executable path when validating a native parent. The source launcher is `open-movie-night`; after deployment, run it from the graphical desktop session:

```sh
python3 /home/chrishallberg/Documents/Personal-Movies/movie-night/desktop/open-movie-night
```

The launcher uses a private lock and PID/start-time record. It verifies process ownership and the exact executable through `/proc` before deciding an application is already running. It can also find this exact binary when it was opened directly. If `xdotool` is available, it activates only a Movie Night window belonging to that verified PID. If activation is unavailable, it leaves the existing application running and does not spawn another instance.

The launch environment, including DISPLAY and desktop session values, is inherited. The launcher does not invent a display, restart services, start or stop mpv, send playback commands, or accept media arguments. It starts the wall only. Stale PID records are validated rather than used to kill processes.

The existing wall service is on loopback port **8789** and its private Aries adapter is on **18879**. The installed units must already be running. Port 8791 belongs to an unrelated application and is not a Movie Night endpoint.

## Build

Build the separate Studio consumer frontend when its JavaScript, CSS, or vendor source changes. With its dependencies and vendor files already installed:

```sh
cd ../studio-shell
npm run build
cd ../desktop
```

That writes `../studio-web`, served by Movie Night's existing local HTTP server. It does not build or modify the managed Studio checkout. Then build the native host when its Rust or capability files change:

```sh
cargo build --release --offline
```

The native result is `target/release/movie-night-desktop`. Rust dependencies are pinned to the reported Aries cache: Tauri 2.11.2, tauri-build 2.6.2, GTK/GDK 0.18.2, GLib 0.18.5, serde 1.0.228, serde_json 1.0.150, and Tokio 1.52.3. Building requires GTK 3, GDK-X11, and WebKitGTK 4.1 development libraries. The plain wall assets in `../web` do not need a frontend build; the React Studio shell does.

The corrected frameless WindowFrame revision compiled and passed the scoped target native-window and synthetic-surface checks below. Its verified `src/native.rs` SHA-256 is `40d55017b01a8ba0e27744aef5e57400fa6a4eb9ef42719e13813191ed2187bc`. That revision is installed on Aries. The authoring container has no Rust/GTK toolchain. Use the existing graphical environment; the host rejects non-X11 native handles.

## Frontend contract and permissions

The native initialization script sets `window.__MOVIE_NIGHT_NATIVE__ = true` on the outer Studio page. There are **seven application commands**: six playback/layout commands passed to the same-origin wall through `window.__MOVIE_NIGHT_SHELL__.invoke`, plus `native_movie_window` called separately by the frame. The shell forwards mode/fullscreen callbacks. The wall bridge excludes the frame command as a routing rule; same-origin parent and iframe content share trust and are not isolated security principals. Neither bridge offers arbitrary shell execution.

| Command | Result and behavior |
|---|---|
| `prepare_movie_player` | Returns true after realizing the native area and atomically writing its receipt. Starts or resumes no media. |
| `show_movie_player` | Returns false unless the running player's IPC `wid` matches this host's dedicated XID. A match shows the native area without changing playback. |
| `show_movie_wall` | Hides the native video area and restores the wall presentation. Does not pause/stop playback or destroy its native parent. |
| `toggle_movie_fullscreen` | Toggles the parent window and returns the new boolean state. |
| `set_movie_viewport({x,y,width,height,visible})` | Validates finite geometry and nonnegative dimensions, clips the overlay to the host allocation, and returns applied geometry/visibility/scale. It cannot activate playback or bypass the existing mpv-parent check. |
| `set_movie_controls_height({height})` | Compatibility call for the wall; validates a finite height and an existing host. It does not resize the full Studio WebView. |
| `native_movie_window({action,direction?})` | Acts only on this application's main window. Actions are `state`, `drag`, `resize`, `minimize`, `maximize` (toggle/restore), `focus`, and `close`. Resize accepts only `left`, `right`, `top`, `bottom`, `left-top`, `right-top`, `left-bottom`, or `right-bottom`. Close enters the existing child-player shutdown handshake. |

The host calls optional `window.movieNightNativeMode(active)`, `window.movieNightNativeFullscreen(active)`, and `window.movieNightNativeWindowState(state)` functions and restores view state after a page reload. Window state reports the real PID/XID, maximize/fullscreen/minimize/decorated/focused flags, physical width/height and screen x/y, and scale factor. The frontend uses native state for frame controls rather than inferring it from DOM geometry. A command response may precede the window manager's final transition; subsequent native events refresh the state. Frontend keyboard handling provides fullscreen F/Escape behavior; native GTK objects remain on the main thread.

`build.rs` declares all seven application commands through `tauri_build::AppManifest::commands`. The capability grants the generated `allow-*` permissions only to the `main` window for `http://127.0.0.1:8789/*`; `local` is false. Every command also checks the calling label and exact origin in Rust. The frame command additionally validates its fixed action/direction vocabulary; it accepts no other window label, URL, process, or executable. Registering a command in `invoke_handler` alone did not grant remote-WebView permission; the explicit build manifest and permissions fixed the observed ACL rejection. Rebuild when this manifest changes.

The local HTTP server supplies the matching IPC-compatible CSP (`ipc:` and `http://ipc.localhost` for connect-src); that policy is maintained outside this crate.

## Private adapter handoff

The runtime directory is:

```text
/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime
```

It must be owned by the current user with mode 0700. `prepare_movie_player` writes `embed-window.json` as a private 0600 file using an atomic rename and fsync. Its fields are `schema: movie-night.embed-window/v1`, `xid`, `pid`, `created_at_unix_ms`, `updated_at_unix_ms`, `backend: x11`, and `window_label: main`. It contains no credential, stream address, or IPC payload.

The adapter validates the receipt and live shell process/window before passing its dedicated XID to a new mpv process. Opening this host does not restart a standalone session. Only an explicit new-film Play may replace a verified independent player with a different parent, after resolving the source and validating its peer/process identity. The adapter uses `vo=gpu` with `gpu-context=x11egl` for the verified Aries build.

## Close behavior

In the native application, the Studio frame's **Minimize** control minimizes the OS window; restore uses the desktop's normal window controls/task switcher. **Close** calls the native window's `close()` method and enters the shutdown handshake below. It does not merely dismiss an inner pane. **Back to wall** changes only the view. The playback bar's explicit stop/close actions use the authenticated player API.

Normal window close is intercepted. The host queries `wid` on private `player.sock`. A different parent means an existing standalone player or another host, which is left alone. Only an exact match receives `quit`; the host waits for IPC EOF before destroying the parent. If that shutdown cannot be confirmed, the host stays open with a static error. Missing/refused sockets mean there is no connected child to shut down.

Only this process's own embedding receipt is removed. Forced process termination is outside the normal close handshake; the adapter rejects dead process receipts. The launcher never uses forced termination to enforce single-instance behavior.

## Verification and product boundaries

The source verification tools separate the things they establish:

| Check | Scope |
|---|---|
| `verification/verify-studio-shell.cjs` | Browser Studio frame rendering, desktop-pane controls, and chat presentation with mocked player status. It does not establish actual OS-window behavior. |
| `verification/verify-browse-ui.cjs` | Live catalogue/library reads, search and pagination, advanced filters, isolated saved views, and TV guard at desktop/tablet sizes; captures browse/drawer screenshots. Every player read is mocked and every write is blocked. |
| `verification/verify-movie-night-ui.cjs` | Playback-control interactions with mocked player/native commands; cannot establish real media decoding. |
| `verification/verify-native-surface.py` | An isolated paused synthetic video, hidden preparation, parent ownership, real pointer input on the measured inert Studio footer, viewport move/resize/clipping/hiding, full WebView sizing, and restored iframe-to-native rectangle publishing. It does not exercise real movie sources or OS frame actions. |
| `verification/verify-native-window.py` | Separate actual OS-window frame-control verification with a private driver/application profile, mocked player reads, no media preparation, and blocked API writes. |

The scripts and reports are packaged and deployed under the application's `verification` directory. **The current native-window and native-surface target reports both passed**, for the Rust source SHA above. Packaged evidence: [verification/native-window-verification.json](../verification/native-window-verification.json) and [verification/native-viewport-verification.json](../verification/native-viewport-verification.json).

The native-window report establishes actual OS drag → resize → drag, maximize/restore, fullscreen through the real button and Escape, minimize/restore, desktop/tablet concierge presentation as one pane inside the frame, and Close destroying the isolated process and X11 window. Minimize checks combined native state, WM iconic/HIDDEN state, and `document.hidden`; the compositor retained a mapped client, so X11 unmapping was not a required condition. Private driver/application profiles were verified, no media was prepared or started, and blocked write attempts were zero. Desktop/tablet screenshots were visually reviewed.

The native-surface report used only an isolated paused generated clip against the same Rust source. It passed actual pointer input on the measured footer, hidden preparation, parent ownership, move/resize/clipping/hiding, full WebView sizing, and alignment after restoring the real Studio RAF publisher. These results do not establish real-source movie/audio playback or native touch/pen behavior. The separate deployment receipt records the production replacement and live visual readback.

Movie Night now has keyless movie/TV metadata browsing, filters over loaded pages, an accurately separated imported Nuvio library, favorites, recent history, and an @ibal/Ollama pane. The concierge currently uses only the canonical 100-film collection. **TV episode playback is not connected. Phone/tablet remote playback/control, watch parties, Loki-hosted access, Arcade, and RealityPools integration are not implemented.** The tablet viewport is a presentation check, not a remote-access deployment. See [../README.md](../README.md) for the library and discovery APIs.

Implementation references: [native viewport and close handshake](src/native.rs), [command manifest](build.rs), [capability](capabilities/movie-night-local-window.json), [Studio frame and iframe bridge](../studio-shell/src/main.jsx), and [frontend build](../studio-shell/vite.config.mjs).
