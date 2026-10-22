# Cube input repair, same MN-002 / issue #4 / framework #1347

Base review generation: `aa67f2d47998ac34accef8ac06ae560f08bd9e0a`. Main remains `816b15233c90f7a846e919fb94e8c0316a14eec5`.
Production diff SHA-256: `b8840e2bcb5490c5bbfb759faf2a8b01e955d5675ccbb3f2f37c696e460da6de`.
One incremental production path: `web/filter-cubes.mjs`; no CSS, shell, chat, provider, player or private-data changes in this increment.

## Actual change
Ordinary vertical wheel remains page-owned. Shift-wheel uses its dominant reported axis, including already-horizontal events. Line/page units are normalized to a CSS-pixel interaction threshold. Partial deltas expire and reset on direction change. Ctrl/Meta/Alt gestures and nested editing controls remain unclaimed. Existing arrow-key, centred selection and explicit opening behavior remain in the same component.

## Reproduce
```sh
git show aa67f2d47998ac34accef8ac06ae560f08bd9e0a:web/filter-cubes.mjs > /tmp/movie-night-input-before.mjs
MOVIE_NIGHT_INPUT_BASE=/tmp/movie-night-input-before.mjs node verification/verify-cube-input.cjs /tmp/movie-night-input-before
node verification/verify-cube-input.cjs /tmp/movie-night-input-after
node verification/verify-container-host.cjs /tmp/movie-night-input-host
```
The host test requires the existing `studio-shell` build, as documented in this review directory. Browser dependency comes from the existing installed Playwright path or MOVIE_NIGHT_PLAYWRIGHT; Chrome is /usr/bin/google-chrome. No package or service is installed by the tests.

## Evidence and limits
Browser 152.0.7961.0. Before/after raw reports accompany this file. 7 of the same 15 assertions fail on unchanged input source; 15 pass on the candidate. Trusted browser wheel/keyboard and real container resizing are distinguished from synthetic WheelEvent probes. Open/select callbacks are instrumentation counters, not playback. All requests are intercepted; zero unexpected network requests.

Earlier harness iterations ran immediately after page load, exposing the initial 180ms input guard but confounding axis comparisons, and the initial empty/singleton loop accidentally reused an already emptied array. Those outputs are retained privately. The final fixture preserves its original records and waits 250ms before each normal interaction. Only the final paired reports are used for the listed comparison. Physical touch/trackpad, other browser engines, installed Tauri, actual episode rows and Loki-origin delivery are NOT verified.

The integrated test uses the actual built browser WindowFrame/Concierge and production wall with synthetic API records. Carousel instance/record/centring and zero source/playback/inference/user-state writes pass. Chat draft loss on reflow/close and narrow host overflow still FAIL. Their existing owner and issue #3 / parent #1347 remain unchanged. This increment does not close them.

## Retained backlog
- #1: episode path, distinct Movies/TV Series, specials and one-off events; source and native playback still separate.
- #3: native escape/fullscreen, auto-hide, tracks, mini-player, bookmarks, bottom-left utilities, real chat reopen/undock and settings/BINS bindings. Dock pinning is owner-confirmed; do not reset it.
- #4: this source input repair, review and installed acceptance still OPEN.
- #5: Western cube request parser/scope and live-query save binding.
- #6: curated sports/live TV, real guide and authorized provider setup, planned not implemented.

All remain within parent settings-sdk-publisher-audit-2026-09-26 / DocketTask 6ab80fd3e24554366e3cf618. Source publication is not admitted worker identity, Bugzilla backfeed, independent review, accepted main, Loki delivery, Aries installed acceptance or APPLY_RETURN. No new PR, backend service, registry or demo.
