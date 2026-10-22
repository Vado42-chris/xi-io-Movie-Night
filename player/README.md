# Movie Night Aries player adapter

`aries_adapter.py` controls an independent standalone **mpv 0.34.1** process on Aries. Aries performs decoding and audio/video output locally. The Movie Night Tauri window supplies a native X11 video parent; the web interface supplies the controls.

The adapter reads existing enabled Torrentio RD add-on configuration to resolve sources. It does not launch Nuvio, change its configuration, reset credentials, or use its installed runtime or libraries. The abandoned `movie-night-player.c` prototype is not part of the current runtime or build path.

## Installed configuration

Private runtime:

```text
/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime
```

The installed unit is `personal-movie-night-player.service`, with these arguments:

```text
player/aries_adapter.py --socket <runtime>/player.sock --token-file <runtime>/control.token --player-command-file <runtime>/player-command.json --port 18879
```

Use full absolute paths in the unit. The adapter listens only on `127.0.0.1:18879`. Pass that port explicitly: the older source default is not the deployed port, and 8791 is reserved for an unrelated application. The wall service passes `--player-port 18879` and the same private controller token path.

| Runtime file | Purpose |
|---|---|
| `control.token` | Local adapter authentication; separate from provider credentials |
| `player-command.json` | Private JSON argument array selecting the independent mpv executable |
| `player.sock` | Private Unix socket for mpv JSON IPC |
| `embed-window.json` | Optional live native parent receipt written by the Movie Night host |
| `selection.json` | Only the selected IMDb ID and title; no stream address or credential |

The runtime directory is owned by the current user with mode 0700; sensitive configuration files and IPC socket are private. The player command must be an argument array, with an absolute executable and no URL arguments. It is executed directly, without a shell. Do not paste provider credentials into that file, command arguments, browser fields, or logs.

## Source lookup and controller boundary

The adapter's default read-only source is the existing Nuvio add-on properties file in the user's application configuration. It selects a compatible enabled HTTPS Torrentio manifest and uses its existing configuration. The source file is never rewritten.

The wall's same-origin gateway forwards only `/status`, `/sources`, `/play`, and `/command` operations to the private adapter. It checks the browser request origin and required application header; the browser is not given the local controller token. The adapter validates and limits control names and returns selected status fields. It does not expose raw mpv commands or arbitrary properties to a browser.

Resolved stream addresses and stream headers are sent to mpv through `player.sock`. Standard output and standard error of the player are suppressed. Selection metadata is cleared when a film stops, the player is idle, or its socket is no longer available, so a closed film does not retain a false resume state.

## Starting and embedding a player

A healthy existing private player socket is reused for status and controls. Opening the native application, preparing its surface, watching, resuming the same film, and stopping do not migrate or restart the player.

An explicit new-film Play can replace a verified independent player whose video parent differs from the prepared native surface. Source resolution happens first. The adapter verifies the connected Linux peer UID/PID, executable, process start time, private socket inode, and live native parent before sending quit on that same connection. It waits for exit before launching the replacement. Unknown ownership, changed identity, or a failed exit stops the request.

When a new player is needed, the adapter adds an isolated idle profile:

```text
--no-config --idle=yes --force-window=no --terminal=no --input-terminal=no
--load-scripts=no --ytdl=no --log-file= --save-position-on-quit=no
--title=Movie Night --input-ipc-server=<runtime>/player.sock
```

The process starts without a film. IPC readiness checks `idle-active`; accepting a later `loadfile` command alone is not proof that playback has begun.

For a new embedded player, the UI first awaits `prepare_movie_player`. The native host writes a private receipt containing the schema, XID, PID, timestamps, backend, and window label. Before using it, the adapter checks ownership and permissions, the schema and numeric fields, the live process owner, the exact `/proc/<pid>/exe` path, and the live X11 window with `xwininfo`. The required executable is:

```text
/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime/bin/movie-night-desktop
```

A valid receipt adds:

```text
--wid=<dedicated-video-XID> --vo=gpu --gpu-context=x11egl
--osc=no --osd-bar=no --keep-open=no
```

`x11egl` is the context verified with the installed Aries build; `x11` was rejected by that build. The video parent is the dedicated DrawingArea XID, not the application top-level window. Movie Night's HTML buttons supply the controls; no additional mpv control skin is installed.

If the receipt is invalid or stale, it is not trusted as an embedding target. The receipt alone never moves an existing film into the shell. The host's `show_movie_player` returns false unless the IPC `wid` property matches its own video parent.

## Closing and verification

Returning to the wall does not pause or stop the film. Explicitly closing the UI player panel stops the current film and dismisses the panel. A normal native application close checks the connected player's `wid`; only its own embedded child receives `quit`. The host waits for IPC EOF before destroying that child's parent. It leaves an unrelated standalone player untouched.

Verified on Aries: all 16 adapter tests, native compilation, real mouse input, full WebView preservation, and an isolated paused 720p test clip embedded with x11egl. The current Studio publisher matched the actual native video rectangle at x=98, y=120, width=1112, height=400 within a 1280×800 WebView. Native move/resize/clipping, hidden preparation, ownership, and return-to-wall checks passed. Actual desktop fullscreen entry and Escape restoration passed. These synthetic checks did not play a commercial film or verify a real source’s audio/codec combination. The standalone Movie Night app now consumes the pinned Studio frame; it is not a registered managed Studio `.app` package.

Primary protocol and implementation references:

- [mpv 0.34.1 options](https://github.com/mpv-player/mpv/blob/v0.34.1/DOCS/man/options.rst)
- [mpv JSON IPC protocol](https://mpv.io/manual/stable/#json-ipc)
- [Tauri capability model](https://v2.tauri.app/security/capabilities/)

See [../desktop/README.md](../desktop/README.md) for native window commands and the wall-only launcher.
