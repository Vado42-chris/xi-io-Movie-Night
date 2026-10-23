# xi-io movie night

**Active prototype, adoption in progress.** Canonical source: `Vado42-chris/xi-io-Movie-Night/main`. Start at [current handoff](docs/CURRENT.md), [manifest](xiio/managed-project.manifest.json), [work ledger](project-tracking/open-work-ledger.md) and [shared shell foundation](docs/architecture/shared-shell-foundation.md).

The historical installation notes below describe an earlier verified generation. They do not override later failures or prove the current source is installed. Suite registration/OS settings belong to the owner’s dot; app source/main belong here. No framework-compliance, cross-device playback or finished-product claim is made.

Safe checks are in AGENTS.md. Do not force-push, expose secrets, alter Nuvio or deploy unrelated services. Runtime/API are partial; native MCP/framework admission is unverified. Update this status and ledgers whenever source, runtime, contracts or verification change.

---

# Movie Night

A personal movie wall whose native application uses the real Studio window frame, with native movie playback on Aries, a curated **Top 100 · 1980–1995** collection, wider movie/TV discovery, imported Nuvio lists, favorites, and an Ollama-powered **@ibal** concierge. The Top 100 ranking is an editorial selection, not an official ratings chart.

**Revision status:** the corrected native window and synthetic video surface passed target verification on Aries. The verified production build was installed and reopened through the existing launcher at 2026-10-22 06:38 UTC; the live wall was visually checked and remained idle. See [deployment receipt](verification/native-window-deployment.json).

## Open on Aries

From the graphical desktop session:

```sh
python3 /home/chrishallberg/Documents/Personal-Movies/movie-night/desktop/open-movie-night
```

The launcher opens the wall only. Opening it again finds the same owned application process and, when `xdotool` is available, activates its window. It does not start a film, restart services, replace an existing player, or change a paused session. The launcher inherits the current display and desktop environment.

The Studio presentation is **http://127.0.0.1:8789/studio**. The independent native application opens that address; the plain browser wall remains at **http://127.0.0.1:8789/**. The Studio frame embeds the same wall at `/?studio=1`, which uses a compact layout without a duplicate application header. These loopback addresses currently work on Aries only.

The shell reuses the actual `WindowFrame.jsx` from `Vado42-chris/xi-io-studio`, pinned at **`94c49141a132ed00cdd72d0457911fc40523794f`**. In the native application, that frame is the chrome of the actual undecorated OS window and fills its client area. Its drag regions, eight resize handles, minimize, maximize, restore, and close controls operate that window directly. Native mode has no extra desktop heading, inner floating Movie Night pane, or simulated taskbar.

A small local `nativeWindow` adapter preserves the existing frame rendering while routing its actions to the bounded Tauri `native_movie_window` command. It disables the component's internal desktop geometry ownership in native mode and uses actual OS state for maximize/fullscreen/focus presentation. The ordinary browser presentation retains the original desktop-pane behavior. The corrected native revision has passed the scoped target checks described below.

The native host is constructed hidden and undecorated, then shown after its GTK layout and handlers are ready; this avoids the pinned GTK/Tao first-map decoration-order problem. Native mouse drag/resize uses `onMouseDown`, with a separate non-mouse pointer path, because WebKitGTK can omit the next `pointerdown` after an OS-owned drag. The actual OS drag → resize → drag sequence passed on Aries. The [maintainer notes](desktop/README.md#startup-and-native-input) describe the rationale; native touch/pen gestures remain unverified.

The original frame source location is `base44-donor/xi-io-node/src/components/desktop/WindowFrame.jsx`; the chat control comes from `base44-donor/xi-io-node/src/components/chat/ChatSnapControl.jsx`. The private consumer and local patch are in [studio-shell](studio-shell/). Missing dependency files were supplied from the qualified donor checkout; this does not make every vendored dependency part of the pinned commit. Movie Night does not modify the managed Studio source or bind its optional managed-account services. Reusing this frame is not a claim of framework admission or publication to a Studio marketplace.

## Live filter cubes

Use **Carousels** to build a home from saved filter queries. Choose a source and filters, then **+ Filter cube**. Each row remains live as that source changes. Swipe, scroll horizontally or use arrow keys; the selected cover stays centred. Click it for details, never automatic playback.

**Edit home** unlocks vertical dragging and Move up/down controls. Add, rename, remove or reorder rows, then **Save layout**, or **Cancel** to restore the saved arrangement. Row **Filters** uses the existing filter editor; **Save cube filters** commits that query. **Wall** shows the same selected query as a grid. New cubes do not have the older 20-view limit, and existing browser-local saved views remain intact.

Install the declared Python dependency with `python3 -m pip install -r requirements.txt` in the app environment. The revisioned private query document is separate from Nuvio, viewing history and preferences. See [implementation and checks](docs/ops/FILTER-CUBES-20261022.md). Online advanced filters still operate on loaded metadata, with additional pages fetched incrementally.

## Browse, filter, and keep your collections

The wall offers separate curated collections, **Nuvio library**, **Favorites**, **Recent**, **All movies**, and **TV series** views. Movie and series discovery uses the fixed local `/api/browse` gateway to Cinemeta metadata; no TMDB key or list-service account is required. Catalogue search sends a title query to that gateway. Load more follows the server's `next_skip` and `has_more`, because a sanitized page may contain fewer records than the provider's pagination stride. See [catalogue_browse.py](catalogue_browse.py).

The filter drawer combines inclusive release-year bounds, multiple included genres with Any/All matching, excluded genres, minimum rating, maximum runtime, movie/TV type, and favorites/watching/watched/unwatched state. Sorting includes title, release year, rating, and runtime. Unknown ratings and runtimes are excluded when the corresponding limit is active. Filter views are named and saved in this browser's localStorage.

**Advanced filters apply to loaded results, not the whole Cinemeta catalogue.** Loading more adds records for those filters to consider. A metadata listing does not establish that a playable cached source exists.

**Import Nuvio library** explicitly refreshes a read-only snapshot of the existing Nuvio library and viewing history. Importing does not change Nuvio settings. Entries whose Nuvio `listKeys` are empty belong in **Nuvio library**; they are not silently classified as favorites. Other named lists remain separate collections. Recent items preserve available season/episode, position, duration, and completion fields. Favorites are an explicit personal Movie Night selection and are saved through the private library API; this is not a two-way Nuvio sync. See [personal_library.py](personal_library.py).

## @ibal movie concierge

The Studio shell includes the **Ask @ibal** chat pane. It uses the configured Ollama service to suggest a collection, shows the proposal, and saves it only after **Save this collection**. Saving refreshes the wall and selects the collection through a same-origin parent message. Chatting or saving a collection does not start playback.

**The concierge currently chooses only from the 100 canonical films in `data/top100-1980-1995.json`.** It does not yet curate from the full Cinemeta catalogue, imported Nuvio titles, or TV episodes. It requires the configured Ollama service and model to be available. See [concierge.py](concierge.py) and [studio-shell/src/Concierge.jsx](studio-shell/src/Concierge.jsx).

## Playback and existing account settings

Movie Night uses an independent standalone **mpv 0.34.1** player on Aries. Its local adapter reads the existing enabled Torrentio RD add-on settings to resolve the chosen film. It does not launch Nuvio, reset its accounts, change its settings, or use its application runtime or bundled player libraries.

The browser sends a selected IMDb ID and limited playback commands to Movie Night's local server. The server authenticates to the Aries adapter with a private local controller token. Provider credentials, resolved stream addresses, and stream headers stay inside the adapter and private player connection; they are not fields in the movie collection or normal browser responses. The controller token is separate from the existing provider credentials.

The UI supports explicit **Play on Aries**, pause/resume, ten-second skips, seeking, volume, mute, fullscreen, and returning to the wall. Returning to the wall changes the view and leaves playback running. The Studio frame's native minimize control minimizes the actual OS window without pausing playback; the desktop task switcher restores it. Its close control enters the native application's shutdown handshake. Closing the player controls stops the selected film and dismisses that panel. Closing the native application quits only a player whose embedded parent matches that application's own video area. An unrelated standalone player is left alone.

Native video uses a **GTK Overlay** above the full-size Studio WebView. The shell publishes the reserved video rectangle in client-area coordinates, and the host clips the native area to that rectangle. Moving the native window carries its video child with it; resizing updates the measured content rectangle. The shell and HTML controls retain their full layout; the former fixed-height controls-strip packing is no longer used. See [desktop/src/native.rs](desktop/src/native.rs).

There are **seven native application commands**: the frame action command and six playback/layout commands in the wall's bridge. The frame command accepts only state, drag, eight-direction resize, minimize, maximize/restore, focus, and close for this application's main window. Rust checks the window label and fixed loopback origin, and the Tauri capability explicitly permits these application commands. The same-origin iframe and parent share trust; separating their bridge methods is not an iframe security boundary. No native command accepts an arbitrary process, executable, or external URL. See [desktop/README.md](desktop/README.md) for the complete contract and close behavior.

Opening the shell and resuming the same film preserve an existing standalone session. When the user explicitly plays a new film in the native shell, a verified independent player with a different video parent is retired only after its source resolves, and the replacement embeds in this shell. Unknown process ownership or a failed exit stops that transition.

## Installed components

| Component | Installed location or address |
|---|---|
| Wall and same-origin playback gateway | `http://127.0.0.1:8789/` |
| Studio window and concierge presentation | `http://127.0.0.1:8789/studio` |
| Private Aries playback adapter | `127.0.0.1:18879` |
| Application source | `/home/chrishallberg/Documents/Personal-Movies/movie-night` |
| Private runtime | `/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime` |
| Native application | Runtime `bin/movie-night-desktop` |
| Private mpv IPC socket | Runtime `player.sock` |
| Native parent receipt | Runtime `embed-window.json` |
| Controller token | Runtime `control.token` |
| Independent player command | Runtime `player-command.json` |

The installed user units are `personal-movie-night.service` and `personal-movie-night-player.service`. Their relevant arguments are:

```text
server.py --port 8789 --player-port 18879 --player-token-file <runtime>/control.token
player/aries_adapter.py --socket <runtime>/player.sock --token-file <runtime>/control.token --player-command-file <runtime>/player-command.json --port 18879
```

`<runtime>` means the full private runtime path in the table. **Use the explicit adapter port 18879.** The older defaults in Python source are not the installed deployment configuration; port 8791 belongs to another application and must not be used for Movie Night.

A read-only status check is:

```sh
systemctl --user status personal-movie-night.service personal-movie-night-player.service
```

The checked-in `personal-movie-night.service` is an older catalogue-only template. It lacks the installed playback gateway arguments; do not overwrite the current installed units with that template. Opening the application does not require restarting either service.

## Reproduce the concierge checks from a clean checkout

Use a full Git checkout of the exact reviewed commit, not a source export: an
existing regression test inspects Git history. Generated `studio-web/` files are
intentionally not committed. `/studio/` serves that built directory, so the shell
must be built before any browser journey. The test runner now refuses a missing
or incomplete build before starting its HTTP server, rather than allowing a
misleading catalogue-load error to obscure the missing prerequisite.

The shell's committed `studio-shell/package-lock.json` was recovered from the
Aries release custody. All 184 installed packages used for the `e099a15` build
matched its version, download URL and integrity entries. Do not regenerate it
with an unconstrained install merely to run tests. The clean replay used Node
22.23.2, npm 10.9.8 and the commands below; no dependency upgrade is implied.

Run these commands only in a dedicated review checkout, never an active runtime
or a shared/symlinked `node_modules` directory:

```sh
python3 -m venv /tmp/movie-night-review-venv
/tmp/movie-night-review-venv/bin/python -m pip install -r requirements.txt
npm --prefix studio-shell ci --ignore-scripts --no-audit --no-fund
npm --prefix studio-shell run build
/tmp/movie-night-review-venv/bin/python -m unittest discover -p 'test_*.py'
/tmp/movie-night-review-venv/bin/python -m unittest discover -s player -p 'test_*.py'
```

The browser harness also needs Playwright and a compatible Chrome/Chromium
executable. These are explicit test-environment prerequisites, not app runtime
dependencies. Reuse an authorized installation or prepare disposable tooling:

```sh
TOOLS="$(mktemp -d)"
npm --prefix "$TOOLS" install --ignore-scripts --no-audit --no-fund --save-exact playwright@1.57.0
export MOVIE_NIGHT_PLAYWRIGHT="$TOOLS/node_modules/playwright"
export MOVIE_NIGHT_CHROME="/absolute/path/to/chrome-or-chromium"
RESULTS="$(mktemp -d)"
for WIDTH in 390 1440; do
  MOVIE_NIGHT_EXACT_REQUESTS=1 MOVIE_NIGHT_TEST_WIDTH="$WIDTH" \
    /tmp/movie-night-review-venv/bin/python verification/verify-concierge-cube-service.py \
    "$PWD" "$RESULTS/exact-$WIDTH"
done
```

The last command uses a disposable private cube store, fixture library and model
status, and simulated native bindings. The two exact requests use deterministic
filters and make **zero inference calls**. Inspect `summary.json` and the browser
report for separate status/inference counts, real save/readback and cold-reopen
results. Passing them does not qualify semantic model requests, real media,
physical Tauri controls, authorized BINS access, public hosting or release approval.

The locked clean build reproduced the installed `e099a15` HTML, JavaScript and
CSS byte-for-byte on the observed Linux toolchain. This is a measured build result,
not a promise of bit-identical output on every operating system or toolchain.

## Verification and exact current limits

The source includes separate checks for the browser window frame, actual native OS-window controls, native video surface, playback controls, and live browsing. The latest report from a target run is the evidence for that build; a successful source build or mocked browser check does not prove real-source video/audio playback.

**The corrected frameless native WindowFrame and synthetic surface checks passed on Aries**, for `desktop/src/native.rs` SHA-256 `40d55017b01a8ba0e27744aef5e57400fa6a4eb9ef42719e13813191ed2187bc`. The evidence is packaged as [verification/native-window-verification.json](verification/native-window-verification.json) and [verification/native-viewport-verification.json](verification/native-viewport-verification.json).

The actual OS-window run passed drag → resize → drag, maximize/restore, fullscreen from the real button and Escape, native minimize/restore, a single concierge inside the frame at desktop/tablet sizes, and Close terminating the isolated application process and X11 window. Minimize was confirmed by native state, WM iconic/HIDDEN state, and `document.hidden`; the compositor kept the client mapped, so an unmapped X11 client was not assumed. The private driver and application profiles were verified. This run prepared and started no media and recorded zero blocked write attempts. Desktop/tablet screenshots were visually reviewed.

The separate native-surface run passed against the same Rust source using only a paused generated clip. It verified the actual footer pointer click, hidden preparation, ownership checks, viewport move/resize/clipping/visibility, the full-size WebView, and restored iframe-to-native RAF alignment. Its visibility cases do not claim to test OS minimize or close. Neither report establishes real-source movie/audio playback or native touch/pen input. The installed production build and its live rendering were also read back; see the deployment receipt.

`verification/verify-browse-ui.cjs` is run on Aries against the live `/studio`, browse, and library routes. It captures desktop/tablet browse and filter-drawer images, checks live search/pagination, loaded-result filters, saved views in isolated storage, and the TV playback guard. It mocks every player read and blocks every playback or other write request, including favorite/import/collection/chat writes. It cannot start a movie or alter the personal library. Run the script from the source package, passing a private output folder, for example:

```sh
node verification/verify-browse-ui.cjs /home/chrishallberg/Documents/Personal-Movies/movie-night-runtime/browse-verification
```

The script uses the existing Aries Playwright installation and `/usr/bin/google-chrome`; `MOVIE_NIGHT_PLAYWRIGHT`, `MOVIE_NIGHT_CHROME`, and `MOVIE_NIGHT_URL` override those paths/address. The URL must remain loopback. The current target run passed both desktop and tablet checks with no live player requests or attempted mutations. Its detailed result remains in the target report.

Current product boundaries:

- **TV is browsing and details only.** Series show “Episode playback not connected yet.” They never dispatch the movie-play endpoint.
- **The concierge is limited to the canonical 100-film collection.** Wider metadata browsing does not expand its candidate set.
- **Phone/tablet remote playback or control, watch parties, Loki-hosted access, Arcade, and RealityPools integrations are not implemented.** A tablet-sized browser layout is not evidence of a working remote client.
- **Cached-source availability is checked when movie playback is explicitly requested.** Discovery results do not promise availability, and uncached-download entries are not selected.
- **Nuvio import is a snapshot, and saved filter views are local to the browser.** There is no automatic two-way library synchronization or cross-device saved-view sync.

## Curated collections

The collection data is in `data/top100-1980-1995.json`; the shelf declaration is in `data/collections.json`. Records contain rank, title, year, IMDb ID, poster URL, and available genre/runtime/synopsis metadata. Public metadata is checked against [Cinemeta](https://github.com/Stremio/cinemeta). Original editorial titles and years can differ from a provider's alternate title or festival/release year.

The server reloads collection data for new requests. A data-only validation starts no server or player:

```sh
python3 server.py --check
```

The catalogue compatibility routes remain available at `/manifest.json`, `/catalog/...`, and `/meta/...`. They publish public film metadata and standard IMDb identifiers. The earlier title, IMDb-ID, and CSV exports make the collection portable; no external list-service account is connected.

The existing Nuvio configuration was backed up privately under `/home/chrishallberg/Documents/Personal-Movies/nuvio-backups/`. Five files were compared byte for byte when that backup was made. This source package contains neither the backup nor its credentials.

See [desktop/README.md](desktop/README.md) for the native host and launcher, and [player/README.md](player/README.md) for the adapter and player connection.
