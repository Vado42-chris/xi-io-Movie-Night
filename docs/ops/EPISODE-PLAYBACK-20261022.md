# Episode playback repair, 2026-10-22

Existing MN-010 TV episode obligation, owner-directed app repair. No new service, settings registry, provider, chat engine or framework qualification.

## Slice 1: existing metadata, adapter and history
Series metadata exposes sanitized episode records with exact series/season/episode identity, including season-zero specials. Existing /sources and /play accept additive series fields; movie requests remain compatible. Opaque sources, cache hits, resume commands and player handoff retain episode identity. Wrong-episode sources fail before player calls. Existing personal-library version 1 holds separate episode progress and exact resume lookup. The existing gateway records observed progress and resolves an explicit resume choice. No Nuvio files are written and no stream URLs are returned or committed.

The installed player is mpv 0.34.1. Its pinned DOCS/man/input.rst confirms per-file loadfile options; resume offsets use that interface, not the incompatible newer positional API. Metadata identity follows Stremio's published series video ID contract.

Executed: 56 Python domain/settings tests, 16 existing player tests and 12 catalogue tests pass. These include 14 new episode tests. Public Cinemeta metadata for tt0374455 returned 102 records over seasons 0 through 5. No private source lookup or media playback was run. UI and installed verification remain pending the next bounded slice. Independent review and shared framework return qualification are not claimed.
