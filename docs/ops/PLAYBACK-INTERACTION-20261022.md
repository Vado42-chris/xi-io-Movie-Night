# Movie Night — existing player interaction repair candidate

Date: 2026-10-22 America/Regina.
Owning work: Movie Night #1 (real episode/source and audio language),
#3 (native transport/mini/fullscreen), existing PR #8.
Source parent: fix/native-player-ux-20261022 @ c6b986ff6f406cde4f258029e4ba87ae94f0342c.

## User-observed regressions
- Fullscreen controls are a permanent bottom strip, don't auto-hide
  after a Play or pointer click, and the close button stops media instead
  of hiding controls. Native first show did not arm the idle timer.
- "Mini player" is a fixed 320px CSS rectangle without drag, resize,
  or independent compact controls.
- "Audio & subtitles" displayed with no choices on the installed
  adapter; **confirmed installed root cause:** Aries main
  player/aries_adapter.py lacks tracks() and audio-track/subtitle-track
  commands, even though the UI has selectors. The PR #8 branch contains
  the backend candidate, but main/installed did not consume it.
- User observed a foreign-language stream and couldn't recover.

## This source increment
- Reuses existing Movie Night app/player gateway and Tauri video
  placeholder. No second renderer, playback engine, stream resolver,
  runtime listener, private library writer, session/identity plane or
  HEX/public command route.
- web/player-mini.mjs owns pure allocated-rectangle calculation,
  pointer/keyboard Move and Size controls, player auto-hide policy,
  bounded language label normalization, and truthful track notices.
- web/app.js binds existing controls to it; one native player session
  is preserved, and hiding the controls NEVER sends Stop. The video
  regains the full reserved viewport after the controls hide.
- web/index.html adds move/resize to the existing control dock, and
  "Choose another stream" in the existing audio/subtitle options.
  Returning to selection keeps the current media alive until another
  explicit Play succeeds.
- player/aries_adapter.py returns a bounded real mpv track list and
  distinguishes a failed track probe from a file with no reported
  alternate tracks; it only switches an ID already in the file.
- Metadata source languages remain *hints*, not promises of available
  playable language tracks. A file with one foreign-language audio
  and no subtitle cannot be translated by displaying more controls.

## Native-video compositing seam — not completed
The existing GTK native mpv overlay is above the WebView. CSS alone
cannot make WebView control buttons appear ABOVE native video. The
bounded candidate uses a native video clip/inset only while controls
are visible, and a small movable/resizable mini video with its same
DOM controls ATTACHED IMMEDIATELY BELOW it. **Literal controls-over-
picture mini overlay remains OPEN** pending a native GTK/WindowFrame
compositor component qualification, not falsely counted as complete.

## Qualification
Executed on Aries in a separate detached worktree, without opening
windows, loading media, changing configuration or restarting services:
- Node pure player/mini policy and static wiring: 6/6 PASS
- New mocked mpv track-readback tests: 3/3 PASS
- Existing Player adapter tests: 16/16 PASS
- Existing application tests: 88/88 PASS
- JS syntax, Python compile, static new-route binding PASS
- git diff --check PASS
The only earlier fixture error was an invalid regex literal in the new
test, corrected before the passing run; the local-main adapter candidate
initially failed an old mocked track-list access, then was corrected to
degrade track probe independently, and re-passed.

Native/physical fullscreen pointer, actual mini video move/resize,
true overlay composition, real audio-track switching on actual media,
subtitles for user's source, and installed-screen readback: NOT RUN.

## Deployment safety
Aries installed main has active uncommitted frontend work; active PR #8
worktree has an independently dirty web/app.js. A direct apply
preflight reports conflict; no overwrite is authorized.
A guarded attempt to install ONLY the live adapter with a backup and
idle check **returned STOP_NOT_IDLE before any write**, because the
player was no longer idle. No live file, user library, service, native
window, tunnel, HEX ingress, or playback session changed.

Next current owner action: reconcile the shared dirty frontend with
this candidate by exact file/hunk; close source adoption via PR #8
after opposing review; perform build and native idle-session preview
with owner safety boundary; only then promote and read back exact
served bytes, native video + panel states and real-user chosen file
track options. Do not treat provider-reported language hints as actual
audio-track proof or the test results as native acceptance.
