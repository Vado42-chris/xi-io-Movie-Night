# Open work ledger

2026-10-22, initial adoption, source evidence checked:
- MN-001: preserve actual Aries source in remote main, with secret exclusions and readback. IN_PROGRESS.
- MN-002: full detail view, safe metadata enrichment, return to unchanged wall. IN_PROGRESS.
- MN-003: explicit stream choice, title-bound opaque source ID, cancel/error/expiry behavior, no implicit auto-play. IN_PROGRESS.
- MN-004: settings completion tests time out on desktop/tablet; diagnose and rerun. OPEN.
- MN-005: desktop pinning mismatch, StartupWMClass versus actual WM_CLASS. OPEN.
- MN-006: current native drag/resize and transparency verification. OPEN; historical passes do not close later failures.
- MN-007: dot's OS settings exact contract and compatibility/deployment proof. WAIT_SOURCE.
- MN-008: suite registration exact readback, dot-owned. OWNER_REPORTED_SAVED.
- MN-009: portable installer, dependency lock and clean-clone build. OPEN.
- MN-010: TV episode playback, real watch parties, remote playback, broader concierge, Arcade and RealityPools integrations. FUTURE; no inert success buttons.

Append evidence-linked changes, do not silently erase failures.

## 2026-10-22 selection and concierge increment
- MN-001: source preservation and first feature increment independently read back from GitHub main, 679a157. No force push or PR backlog.
- MN-002/MN-003: full detail and explicit source-selection browser regressions pass on desktop, tablet and phone. Real media playback was not attempted in these tests.
- MN-002: selection carousel now reuses the wall filter nodes and ordering, with previous/next, keyboard, swipe and horizontal-wheel handlers; zero-result and return-state browser checks passed. Physical touch remains unverified.
- MN-010 concierge sub-slice: existing dock restored; current filtered identifiers resolve against server-known metadata. Real local llama3.1:8b returned a two-title proposal from a 20-title filtered selection. No cloud fallback or automatic save/play. Desktop/tablet dock tests and page-restart persistence passed with simulated native commands. Native deployment verification remains required.
- MN-010 TV episode sub-slice remains OPEN; a series card is not playback proof.
- Same suite rebaseline and coordination ownership retained. No assignment, AI Mail delivery, receiver ACK or APPLY_RETURN has been fabricated.

2026-10-22, MN-002 consumer increment: live filter-cube home and shared centred carousel source/browser checks pass after consuming settings/provider-filter main 6bbb760. Exact installed readback is pending. Shared services, TV playback, palette and suite rebaseline are not closed by this slice. See docs/ops/FILTER-CUBES-20261022.md.

## 2026-10-22 title-detail specimen and width repair
- MN-002: obsolete 600px carousel / 1040px detail caps removed; existing related-film recommendations exposed outside collapsed credits. Exact padded width, centred selection, keyboard and no-overflow source checks pass at 1920/1280/768/390. Native current-window refresh not performed.
- MN-010 TV sub-slice: source-reproduced failure, not a credentials diagnosis. UI blocks series; metadata omits episodes; source resolver and player payload accept movies only. Season/episode/specials and loading/empty/error states are available for review in the reusable title specimen. Actual episode playback remains OPEN. No second backend or tracking programme.


## 2026-10-22 playback usability correction, same #1/#3/#5 and PR #8
- Runtime mismatch reproduced: accepted main includes episode metadata/backend support, but the actual wall/player services predated that source. Reloaded only those two existing idle Aries services from unchanged main 816b152; live Son of Zorn metadata then returned 13 episodes, with playback remaining idle and the native window untouched. This is metadata readback, not playback acceptance.
- App candidate extends the existing detail/source flow with season/episode selection including S00, full episode identity through source/play/resume, mismatched/stale source rejection, safe provider-description and filename hints, Play beside each source and the selected-source action before the list. No new player, provider registry, BINS engine or authority path.
- Candidate tests: existing 58 top-level and 16 player Python regressions passed; paired old parser tests fail as expected. Browser qualification uses exact app code with fixture metadata/player responses and blocked writes, never actual film playback. Initial readiness-race harness failures remain preserved. Exact final results are in the existing private native-player-ux/playback-usability custody and the source runner.
- The new music/YouTube/social/free-versus-concierge scope is retained in docs/architecture/shared-shell-foundation.md under the existing parent. It does not postpone broken playback, constitute a provider integration or change billing.
- Source publication, accepted main, installed UI/adapter, real media/track behavior, BINS host integration and RETURN/APPLY_RETURN remain distinct. No new worker identity or admission claimed.
