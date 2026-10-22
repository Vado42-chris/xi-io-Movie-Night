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


## 2026-10-22 universal episode-card correction, existing #1 / PR #8
Owner reports missing episode links across series, not only Son of Zorn. Prior single-show backend readback did not satisfy the application journey. The actual served wall still lacked renderEpisodes at this pass's first observation, despite accepted backend metadata. Existing candidate showFilm is the common entry across Library/Favorites/Recent/catalogue/carousel/cubes/deep links, and is now revalidated across the 461-ID private-library denominator using explicitly synthetic episode replies. Real service readback sampled 12 series and 2,616 correctly parent-bound episode records; do not expand that coverage claim.

Repair the common adoption path: title details loaded does not mean episode hierarchy loaded. Every supported series open/reopen reads through the existing cached metadata gateway, with visible incomplete/empty/unavailable/disabled/unsupported states and no agent-assisted per-title patches. Server metadata cache remains the cache owner, no second library or client retention policy. Source selection and Play remain separate. Prevent release false positives with exact served HTML/JS/CSS generation checks in the existing browser runner. Preserve source-only, local test-serving, active native loaded generation, accepted main, real playback and parent-return states separately.


## 2026-10-22 episode-card art/details, same #1 / #3 / PR #8
Existing intake `episode-card-details-20261022/source.json` and pre-change bytes were recovered instead of creating another task. The earlier chat progress text was not a source implementation: head remained 16ef0e7 with no card changes. Continuing that exact candidate adds existing-provider artwork/name support, opt-in spoiler disclosure, optional episode credits and read-only exact episode history labels. Missing metadata versus empty data is repaired at the producer, not hidden behind a frontend label. Original failing tests and the first browser readiness race are retained. A real busy-state update now disables Refresh during the pending metadata read; the browser wait observes that real operation state.

Reusable lesson: image, safe identity/facts, selected state, optional sensitive detail and domain actions must be distinct parts of one card. The supplied design's card/action separation is useful; its static hashes, verification badges, latency claims, replacement palettes and BINS permission labels are not runtime evidence or accepted contracts. Apply the same interaction principle to other consumers through their owners, not by copying media-specific behavior.

BINS remains unavailable because its authenticated host/resource binding is missing. No per-card fake BINS link or duplicate episode database is added. These exact media identities can be carried to the existing resource/cube contracts when that admitted service exists; cross-app persistence, note/bookmark storage and sharing are not established by this increment. @ibal must use those same identities/capabilities, not infer access from metadata. Admission work #351, execution/return #426 and Loki #1237 retain their owners and open dependencies.


## 2026-10-22 cube controls / media-center owner correction, same Work and PR #8

- MN-002/#4: served Shift-wheel ignored browser-rotated deltaX. Existing PR #7 at 28aca927 already owns the component repair. Its exact production module/CSS were consumed before the cube-builder changes; PR #7 remains open, no replacement carousel and no merge claim. Original donor input runner replayed with separate trusted-browser and synthetic-event cases.
- Existing cube home: add a discoverable bottom Create Cube action and three-step Source / Filters / Review wizard; per-row Edit Cube uses the same existing query declaration, filter evaluator, revision writer and independent GET readback. New local UI is not a new BINS engine. Preserve edits on rejected/unknown save; unknown outcomes reconcile reads only, not automatic repeat POST.
- #5/MN-010 remains OPEN: existing @ibal currently proposes/saves snapshot collections via /api/concierge/save, not CRUD against live query cubes. It needs to submit a validated intent into this same review/save workflow, bind exact cube ID/revision for edit/remove and require explicit destructive confirmation. Do not report local-chat output as a saved cube.
- BINS/host integration remains OPEN under existing framework #1347/#426/#351 and host #1237/#344/#276. The existing local cube document is not a globally retrievable authenticated BINS resource. Canonical projection must preserve cube identity/revision/query/owner/permissions, without copying a library or adopting Base44 as the permanent service.
- Provider configuration remains OPEN: current cube declaration admits only nuvio/cinemeta as metadata-source filters. These are not provider entitlements. Recover existing connector/capability owners; separate metadata origin, per-region viewing offers, authenticated connection state, current playback access and personal-file location. Do not add dummy account buttons or infer subscription cancellation from a timeout.
- Reality Pools is an existing media-center consumer. Source rechecked at main 40ce6d821c46e78ef2e6e6ea8689e376d46a301e. Preserve ContentAtom and the five-engine boundary rather than duplicate analysis, identity normalization, scoring or publishing. Cross-product identity/auth/spoiler gates remain unqualified. No writes made to its repository.
- User screenshots 20261022-210649 and 20261022-210723 show detail/home carousels and the existing single home row with the upper Create/Edit actions. Their visible UI is source evidence of the user journey, not physical wheel-event proof. No image-generated replacement UI was created.


## Re-ack reconciliation of cube-controls continuation, same Work
- Independent readback: framework #1314 is closed unmerged at e8a0530; do not publish a replacement formatter. Ibal #80 and framework #476 retain obligations, with #434/#551 return semantics. No worker binding or credential is invented by this app-local repair.
- Preserved the interrupted uncommitted wizard and donor adoption. Actual manual tests exposed an unreachable recovery button behind modal inertness. Move the same control into the modal; test real pointer and keyboard events, not element.click() injection. Also distinguish write-refusal from post-write readback denial; pending outcomes reconcile GET only.
- Existing real cube store was already implemented. This increment changes only consumer UI and tests. No storage schema, provider account, BINS engine, authorization registry, source generation in shared Node/Studio or Reality Pools is changed.
- Current provider field is metadata origin, not subscription availability/entitlement/playability. Those three answers stay independent, regional/time-bounded and authoritative where a supported adapter exists. No fake Prime/Disney Connect or silent Nuvio fallback. Private Drive/Dropbox/OneDrive media should be indexed through the existing authorized BINS resources by stable provider ID/version; matching suggestions stay reviewable and user corrections persist. Short-lived playback URLs are not identities. This is retained acceptance scope, not an implemented service.
- Latest review-environment browser failure is not a native pass. This lane separately exercised real Chromium on Aries with fixture provider replies, plus isolated real file persistence. Browser/script events do not qualify physical trackpad/Tauri events, account entitlements or real media.
