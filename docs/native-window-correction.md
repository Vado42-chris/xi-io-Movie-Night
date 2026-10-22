# Movie Night — the Studio rendering is the native window

Record: `movie-night-native-window-20261022`  
Status: corrected, verified, deployed and read back on Aries at 2026-10-22 06:38 UTC.  
Mode: Hallberg reconciliation. Observer: Chris Hallberg, using Movie Night on Aries.

## Summons and supersession

Chris reported: “you are rendering the windows within a window, i need the renderings to be the windows.” His screenshot, `image(20261022-060353).png`, shows an OS title bar, an outer Movie Night header/taskbar, and a movable Studio frame inside that desktop. Inspection of the deployed source confirmed the same arrangement. The preceding release met the component-reuse condition but failed the intended native-window condition; its shell-completion claim is superseded by this correction.

## Bound implementation

| Component | Responsibility |
|---|---|
| `desktop/src/native.rs` | One undecorated native Tauri window; authorized native move, resize, minimize, maximize/restore, focus and close operations; OS state readback. |
| `studio-shell/vendor/src/components/desktop/WindowFrame.jsx` | Existing Studio frame, with an explicit local native-host adapter; its chrome fills the native client surface. Browser desktop behavior remains available. |
| `studio-shell/src/main.jsx` | Native actions bound to that frame; no outer header/taskbar or internal floating-window geometry in native presentation. |
| Native concierge presentation | A dock or content pane within the existing window, including tablet widths; no extra simulated floating window. |
| Playback adapter and Nuvio | Existing playback implementation retained; Nuvio configuration and credentials untouched. |

The upstream frame remains identified by commit `94c49141a132ed00cdd72d0457911fc40523794f`. The native-host adaptation is a local patch with separate provenance, not an assertion that upstream already contained the change. This personal consumer is not an assertion of managed Studio publication or framework execution admission.

## Acceptance and evidence

The corrected native frame must fill the entire OS client surface. Real pointer input must move and resize the top-level X11 window while the frame stays at client coordinates `(0, 0)`. Its maximize/minimize/close controls must change the actual OS window, with independent X11 state/readback. Chat must remain inside the same frame at desktop and tablet sizes. The video viewport must remain aligned after changing the shell layout.

Verification uses a separate test executable, private runtime and private browser profile. It must not resolve or play a commercial title. Any synthetic viewport test uses only an isolated generated clip. Native compositor transparency is outside this correction's acceptance claim.

## Resolved defects

The native host is now created hidden and undecorated, then shown after its GTK layout and handlers are installed. This resolves the observed first-map ordering problem in the pinned Tao build, which had left a 37-pixel frame-extents discrepancy. The final window has matching native outer/client coordinates, zero client border, undecorated Motif hints, and no nonzero WM or GTK decoration extents.

Native mouse drag and resize now start from `mousedown`. After the first OS pointer grab, WebKitGTK delivered the next trusted `mousedown` but omitted `pointerdown`; relying solely on pointer events made the next resize fail. Non-mouse input retains a separate pointer handler with compatibility-event suppression. The browser's ordinary Framer path is retained. Mouse behavior was exercised on Aries; touch/pen behavior was not independently verified.

## Verification, return and readback

Native Rust source SHA-256: `40d55017b01a8ba0e27744aef5e57400fa6a4eb9ef42719e13813191ed2187bc`.

The [native-window report](../verification/native-window-verification.json) passed actual titlebar drag, southeast resize, a second titlebar drag, maximize/restore, fullscreen from the visible button and real Escape, minimize/restore, desktop/tablet concierge, and close. Close exited the isolated process and destroyed its X11 window. The frame remained at `(0, 0)` and filled the native client area throughout. Native minimize was independently confirmed by native state, WM iconic/HIDDEN state and document visibility; this compositor kept the X11 client mapped, which is recorded rather than treated as a failure. No movie was prepared or started, no player socket or live embedding receipt was accessed, and no API write was attempted. Both the driver and application private profiles were verified before testing.

The [native-surface report](../verification/native-viewport-verification.json) passed against the same Rust source using only an isolated paused generated clip. It verified real pointer input, hidden preparation, parent ownership, rectangle clipping/visibility, full WebView size and restored iframe-to-native video alignment. That runner did not itself certify browser-profile isolation; its report preserves that limitation. These checks do not certify a commercial source or audio device.

The [deployment receipt](../verification/native-window-deployment.json) records a normal close of the preceding Movie Night process after confirming the player was idle, atomic installation of the verified production build, and reopening through the existing launcher. Production binary SHA-256: `3243cbaae669b11112d2397cd57fec4218ff1c25bf30982ea01f916e9b70e6c2`. The live replacement was visually reviewed at 1280×800: one Studio frame, no second desktop frame or OS title bar, cover-art wall loaded, and playback idle. Native test support processes were stopped afterward; the production application remained open.

The prior binary and source remain privately backed up under `movie-night-runtime/native-window-change/before`. No Nuvio installation, account setting or credential was changed. No media was launched by this correction. The updated source, explicit vendor patch and receipts supersede the previous shell-completion claim without rewriting its history. This closes this personal-app correction only; it does not certify managed Studio publication, native transparency or the broader framework ACK chain.
