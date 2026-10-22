# Native shell and player primitive audit, 2026-10-22

Existing Movie Night #3, MN-005, shared #1347; parent `settings-sdk-publisher-audit-2026-09-26`. Base `816b15233c90f7a846e919fb94e8c0316a14eec5`.

This extends existing owners and components. It does not register new primitives, grant runtime admission, close defects, or replace chat/Settings/BINS. Source candidate and installed main are separate.

The failure is incomplete binding between the existing frame, native host, content iframe and domain session. Presentation transitions and media effects must remain independent.

## P0: Cross-surface input routing

**Evidence:** SOURCE_CONFIRMED; fullscreen candidate built, native gestures NOT_TESTED. Source: `desktop/src/native.rs; studio-shell/src/main.jsx; web/app.js; player/native-input.conf`.

WebView, iframe and native video own separate input paths. Existing main has no native video-to-host gesture bridge.

**Existing owner:** Existing host adapter and app input bindings. **Acceptance:** Focus each surface; Escape exits actual fullscreen without stop/load; video double-click toggles once; typing in chat never invokes media shortcuts.

## P0: Shortcut and preference parity

**Evidence:** OBSERVED_IDLE_MPV; no media started. Source: `player/native-input.conf; xiio/settings.schema.json /playback/seek_seconds`.

Actual mpv with candidate input file retains LEFT/RIGHT seek -5/+5, while declared application default is 10. Native wheel/right-click/q/Enter remain separate default behaviors.

**Existing owner:** Existing player adapter and declaration consumer. **Acceptance:** Use one declared skip preference through button, keyboard and native video; classify each remaining default intentionally; no unintended quit/next from context change.

## P0: Escape independent of playback readiness

**Evidence:** SOURCE_CONFIRMED; candidate not installed. Source: `web/app.js updatePlayerControls/togglePlayerFullscreen; desktop/src/native.rs`.

Main couples fullscreen availability to active playback/control readiness. The candidate separates it and adds native exit, but needs installed blocked/loading/disconnected verification.

**Existing owner:** Existing host action owner. **Acceptance:** Escape and visible Exit work while paused/loading, source lookup pending, player disconnected and controls hidden; no recovery action reloads media.

## P0: Native surface focus and accessibility handoff

**Evidence:** UNQUALIFIED_NATIVE_BOUNDARY. Source: `desktop/src/native.rs initialize_host/apply_viewport; web/app.js`.

Native video is a separate GTK/X11 surface above the WebView. A DOM focus ring or underlying dblclick handler does not prove native focus escape or accessible controls.

**Existing owner:** Existing frame/native integration owner. **Acceptance:** Tab/Shift+Tab traverse video, controls, modal and chat; focus returns to invoker; no hidden controls receive input; true mouse/touch hit tests, not DOM event dispatch only.

## P0: Draft and pending-operation continuity

**Evidence:** PRIOR_BROWSER_REPRODUCTION + SOURCE_CONFIRMED. Source: `studio-shell/src/Concierge.jsx; studio-shell/src/main.jsx; studio-shell/src/Settings.jsx`.

Chat prompt/busy/proposal live in a component remounted at docking changes; previous host replay loses drafts at 1024/1023 and close/reopen. Settings close ignores dirty state and opening replaces draft.

**Existing owner:** Existing chat/frame/settings owners under #1347. **Acceptance:** Resize/dock/hide/reopen while editing and awaiting a response; preserve the same conversation, draft and operation; provide deliberate discard rather than accidental loss.

## P1: Real undock and reopen lifecycle

**Evidence:** SOURCE_CONFIRMED_MISSING_NATIVE_BINDING. Source: `studio-shell/vendor/src/lib/chatDockStore.js detachChat; studio-shell/src/main.jsx; desktop/src/native.rs`.

DETACH changes store layout. Native host builds only main, authorizes only main and has no owned chat-window creation/focus/reopen adapter. Arbitrary new windows are correctly denied.

**Existing owner:** Existing shared chat/window owner. **Acceptance:** Undock creates one authorized native child with same conversation; close/reopen/redock preserve it; do not enable arbitrary window.open or replace the chat engine.

## P0: File export completion and native save binding

**Evidence:** SOURCE_CONTRADICTION; native save not attempted. Source: `studio-shell/src/Settings.jsx:161-170; desktop/src/native.rs on_download`.

Settings clicks a Blob download and immediately reports Exported; native host denies downloads. No saved-file completion is observed by that UI.

**Existing owner:** Existing settings + native file/BINS adapter owner. **Acceptance:** User-selected scoped destination; cancel/error/success distinct; read back resulting preferences file before claiming saved. Keep broad download denial until a bounded existing adapter is wired.

## P1: Desktop identity and pin/relaunch

**Evidence:** DESKTOP_FILE_VALID; NOT_PINNED; WINDOW_ASSOCIATION_UNVERIFIED. Source: `desktop/open-movie-night; installed personal-movie-night.desktop; desktop/tauri.conf.json`.

Installed desktop file validates and launcher has single-instance logic. It is not in favorites; template is untracked. Matching actual WM_CLASS and dock launch/relaunch remains unverified.

**Existing owner:** Existing MN-005, indexed in Movie Night #3. **Acceptance:** Match app identifier, executable, icon and actual window class; cold launch/focus existing/minimized restore/pin survive restart without duplicate instances or changing other favorites.

## P1: Native geometry and monitor restoration

**Evidence:** SOURCE_CONFIRMED_GAP. Source: `desktop/src/native.rs builder; WindowFrame.jsx onGeometryChange; studio-shell/src/main.jsx openingGeometry`.

Native always opens 1280x800 with 760x540 minimum; geometry persistence callback is skipped for native. Browser geometry saving is not native restore.

**Existing owner:** Existing frame/native geometry owner. **Acceptance:** Persist/restore native geometry with monitor-safe bounds and scaling; unplug monitor and reopen; distinguish native minimum from phone browser test dimensions.

## P0: Recoverable native viewport publication

**Evidence:** EXECUTED_EXACT_SOURCE_WITH_INJECTED_FAILURE. Source: `studio-shell/src/main.jsx publishViewport`.

One rejected set_movie_viewport permanently sets failed=true. Eight simulated frames produce only one attempt, with no rebind/retry path.

**Existing owner:** Existing native viewport binding owner. **Acceptance:** Bounded geometry-only retry or explicit Reconnect; observed healthy state clears error; pause/resume/load remain untouched; no unbounded retry or media restart.

## P0: Media/session identity on all state-changing actions

**Evidence:** EXECUTED_MOCK_BOUNDARY; no player used. Source: `web/app.js sendPlayerCommand; player/aries_adapter.py Adapter.post`.

Ordinary seek/skip/pause/stop omit identity; adapter accepts omission. Explicit wrong identity is rejected. Candidate track actions bind movie/episode identity but the older path remains optional and has no playback-generation token.

**Existing owner:** Existing product player/domain adapter owner. **Acceptance:** A control captured for A cannot seek/stop B after source or episode switch; bind exact media and session generation; stale actions have zero effect. Keep emergency host escape independent.

## P1: Independent playback and presentation state

**Evidence:** SOURCE_CONFIRMED_MISSING_MAIN_PATHS; candidate partial. Source: `web/app.js nativePlayerMode/closePlayerControls/setMiniPlayer; desktop/src/native.rs set_mode`.

Main has wall versus full player, and close controls stops playback. Candidate mini view is within the same window, not OS picture-in-picture; repeated mode callback currently resets mini state.

**Existing owner:** Existing media presentation consumer. **Acceptance:** Normal/fullscreen/mini/details/hidden controls do not load media; stop and quit are separate deliberate actions; preserve source, timeline, tracks and focus.

## P1: Runtime capabilities and media options

**Evidence:** SOURCE_CONFIRMED_MISSING_MAIN_UI; track candidate partial. Source: `player/aries_adapter.py tracks/command/status; web/index.html; web/app.js`.

Main lacks audio/subtitle selection, scene markers, chapters, playback speed and output-device UI. Candidate exposes enumerated tracks only. Buffering/seeking/ended and capability-specific states are not fully projected.

**Existing owner:** Existing media adapter plus shared typed choice/status controls. **Acceptance:** Only observed tracks/rates/devices exposed; subtitle Off; real command/readback; no-track is not loading. Scene bookmarks retain exact movie/episode/time and persist through existing authorized data custody.

## P1: Explicit Quick Play source policy

**Evidence:** EXISTING_RESOLVER_REUSED; candidate not installed. Source: `player/aries_adapter.py Resolver.sources; web/app.js quickPlay`.

Resolver already ranks eligible sources by declared quality and smaller-encode preference. Candidate Quick Play selects that ordering only after explicit click. No measured bandwidth or adaptive-quality evidence exists.

**Existing owner:** Existing source-selection owner. **Acceptance:** Explicit click binds current title/source; stale/absent choices fail; show actual preference basis; manual selection remains; bandwidth unknown never becomes measured-safe.

## P1: OS media, power, startup and recovery integration

**Evidence:** NOT_FOUND_IN_INSPECTED_APP_BINDINGS; OS_EFFECTS_UNTESTED. Source: `desktop/src/native.rs; desktop/Cargo.toml; desktop/open-movie-night; web/app.js`.

No app-owned MPRIS/MediaSession binding found. Sleep/inhibition and device-loss policy are not qualified. Launcher checks process, not frontend readiness; external loopback page has no owned startup-recovery surface. mpv may independently inhibit screensaver; do not claim OS absence from source scan.

**Existing owner:** Existing native host/system-service owners. **Acceptance:** Media keys address correct session; inhibit only appropriate states; resume/device removal retains safe state; missing host/bridge offers retry without blank trapped window or media restart.

## P1: Utilities, provider setup and effect capability binding

**Evidence:** SOURCE_CONFIRMED_UNBOUND_STUDIO_SERVICES. Source: `studio-shell/host/studio-services.js; studio-shell/src/Settings.jsx; app_settings.py`.

App settings declaration works but is not the full OS catalogue. Managed account/functions/entities explicitly throw STUDIO_SERVICE_UNBOUND. BINS/cloud imports and OAuth setup cannot be inferred from connector access or shell icons.

**Existing owner:** Existing API Glass Box/plugin Work + BINS + settings owners, no new connector lane. **Acceptance:** Cog opens full shared catalogue at app; BINS opens authorized scope; real connection test/write/readback; queued worker/connector available is not installed app binding. Preserve existing Work and return route.

## Evidence and limits

`mpv-input-bindings.json`: actual installed mpv, idle/no video/audio, private temporary socket. Default LEFT/RIGHT still use five-second seeks. `viewport-recovery.json`: exact production publication loop in Node VM with injected rejection, not native browser proof. `primitive-command-probe.json`: mocked adapter boundary, not actual playback.

Original first probe hit AF_UNIX pathname length; the failed fixture was stopped and rerun with a short private temporary socket. That is a harness defect, not a product failure. Retained in `first-harness-failure.json`.

Existing main already implements drag, eight-edge resize, minimize, maximize/restore, real window-state readback, bounded close/player shutdown and a single-instance launcher. Do not rewrite or label these wholly absent. Current native input/mini/track/Quick Play changes have compiled and passed listed Python regressions, but native gesture, installation, Loki delivery and independent consumer acceptance remain open.

## Incoming integration-lane context

Owner reports existing API Glass Box/plugin Work updates and connector ingress repairs. Treat those as dependencies, not proof this app is bound. Preserve BoundaryRequest -> handoffPull -> verifyReturn -> applyReturn and actual BINS custody. Do not add a parallel provider connection project or assume personal NotebookLM account support from an Enterprise API.

## Reuse in the five existing specimens

Frame/chat tests focus and lifecycle; card/action tests semantic routing and stable identity; Settings tests declared scope plus actual save/export effects; comparison tables test allocated width and keyboard scroll; Work status tests requested/pending/refused/observed completion. Run these in real native and browser consumers. Movie Night alone cannot qualify the suite.
