# Current handoff

## Discovery recovery, 2026-10-23

Continue existing Work `settings-sdk-publisher-audit-2026-09-26`, Movie Night #5 / PR #8. The owner's BATMAN VS TEENAGE screenshot showed simultaneous search failures, not proof the title is absent from the provider. Before this patch, live Cinemeta and the local API both returned `tt9775360` with its 2019 title; a separate permitted source lookup returned six sources without playing anything. Retries and truthful state, rather than a hard-coded title or another provider registry, are the bounded repair.

Movie and TV searches now render independently. Transient 502/503/504 reads receive one bounded recovery attempt per type; a manual retry addresses only failed or stale types and does not advance a successful cursor. Superseded requests are invalidated immediately on input. Search text is not counted as a local filter; search outage, successful empty response, partial results and cached data have distinct user-visible states. Bin query filtering depends on its own source identity, not which unrelated collection is currently visible.

The existing in-memory catalogue cache can supply a nonempty exact-path snapshot for at most 15 minutes beyond normal expiry when a live refresh fails. It labels the response stale, never extends expiry on failure, never supplies another query/type/offset, and never substitutes metadata readback or authorization. No new storage or provider integration.

Executed writer qualification on the exact parent aa9154b: expanded browser suite 2/18 before versus 18/18 after (nine cases at two widths, not 18 independent bugs). Twelve cache cases: seven pass/five error before, twelve pass after. Full Python application suite 108/108 including those twelve, existing catalogue self-tests 12/12, player suite 16/16, syntax/server/diff checks pass. Existing manual HTTP writer/cold-readback journeys pass at 390/768/1280 with zero AI calls. Their edit-button lookup now uses the already-published pencil control's exact accessible name; no click-first workaround. Live catalogue/title/artwork passed at 390/1280 with candidate app.js; only player polling was simulated and all writes blocked. Installation and served-file readback are recorded separately in the PR return.

Reproduce: `python3 verification/verify-discovery-recovery.py . OUTPUT`, with existing MOVIE_NIGHT_PLAYWRIGHT/MOVIE_NIGHT_CHROME configured. The runner generates synthetic fixtures from the repository schemas and intercepts every browser request; no running service or private account is required. Preserve the baseline and earlier imperfect two-pending-response race fixture logs as superseded harness evidence.

Still open: independent peer review, accepted-main adoption, native and real-media playback, broader provider connections, Loki-server/Aries-client streaming, BINS shared authorization, Articles adoption and worker return. No AI/quorum, public hosting, credential, Nuvio mutation or new Work is claimed.


Date: 2026-10-22. State: active prototype; settings and provider-filter source on main; provider UI visually read back in the reopened native app. Broader native and suite qualification remains open.

## Independent concierge replay and build prerequisites, 2026-10-22

The owner relayed Claude's independent replay of exact `e099a15`: 82 application
and 16 player tests, plus the two exact request journeys at 390/1440, with real
disposable writes, fresh-process readback and cold page reopen. This is reported
independent source evidence, not Claude verification of Aries, real inference or
native input. The external scratchpad was not retrieved or represented as ingressed.

The reported build gap is confirmed: `studio-web/` is generated and the source
branch omitted the retained shell lockfile. The bounded follow-up recovers that
existing lockfile without upgrading dependencies, adds a pre-server missing-build
check to the existing browser runner, and documents all clean-checkout prerequisites.
Six new prerequisite tests are environment coverage, not six new product capabilities.
Fresh dependency installation and build were performed only in a disposable review
checkout. Their HTML/JS/CSS match the installed `e099a15` build byte-for-byte on the
observed toolchain. No running service, private library, native window or installed
node_modules tree was changed. PR #8 remains the integration owner; accepted main,
physical native acceptance, BINS/worker return and public hosting remain separate.

## Approved concierge delivery, 2026-10-22

Owner approved finishing/testing the existing chat-to-cube change, publishing through PR #8 and patching Aries. Continue Work `settings-sdk-publisher-audit-2026-09-26`, #5 and the existing writer branch. No new store, provider account, shell or autonomous-worker authority.

The installed generation lacked both the cube-operation handler and shell/iframe bridge. Adopt the retained connection as one matched backend/shell/wall increment. Explicit supported genre/type/year cube requests now use the existing constraint parser and row declaration without generative title-list output. The owner's typo and `1985-to present` form are covered; rolling `present` remains stored, not frozen to a calendar year. Semantic requests not completely understood still use the existing schema-constrained model path. High fantasy is not asserted to be a supported separate genre: the proposal clearly discloses broader Fantasy matches, retains the dates, and requires review. No partial query is silently saved.

Confirmation still uses the existing manual editor, revision writer, independent GET and cold reopen. Revealing a confirmed row also works when its query has zero matches; local-source empty text no longer suggests loading a worldwide catalogue. The selected source remains explicit and is never silently changed from the user's library. Older still-loaded chat clients fail with a specific update message, not a legacy recommendation-list fallback. The native app is not closed or reloaded by installation.

Qualification: 82 top-level Python tests, 16 player tests, server check, JavaScript syntax and shell build pass. Actual Chromium plus the real HTTP handlers/file writer pass the two exact owner requests at 390 and 1440 pixels with independent cold-process readback. Those explicit requests perform zero inference calls. The full create/edit/remove/manual-parity/replay/wrong-source/uncertain-readback/reopen journey passes with fixture model status. Browser native bindings and media are simulated/blocked; this is not physical Tauri, real media, BINS admission or public Loki acceptance. Two test-harness timing/state errors are retained in private evidence: expecting deliberately closed chat to reopen, and reading an IntersectionObserver-painted card before its paint. Neither was hidden by weakening the required product outcome.

Source publication, installed asset readback, owning-main acceptance and active-window adoption remain separate. No public LIVE promotion, credentials, original Nuvio data, existing cube/library contents, shared source or Loki routing is authorized by this increment. Rollback must retain readers/writers for any already-saved rolling-year values.

## Conversational cube review, 2026-10-22

Continue #5 / existing PR #8 / Work `settings-sdk-publisher-audit-2026-09-26`. The app-owned source connection is chat -> typed existing-schema row -> existing manual review -> explicit user save -> same revision writer -> separate stored readback -> confirmed cube ID/revision shown in the same chat. Create/edit/remove share this path. No automatic worker execution, BINS authorization, main acceptance or Loki delivery is implied. The shared declaration adds `yearTo="present"` for a rolling calendar-year bound; manual and chat consume it equally. Reproduce the real disposable HTTP journey with `verification/verify-concierge-cube-service.py`; its default model is a fixture, with explicit `MOVIE_NIGHT_REAL_MODEL=1` for the real local-model check. Read the dated ledger entry for evidence classes, historical dispatcher recovery, failed model responses and exact host/authority blockers. Preserve current manual behavior and user data.

## Cube builder and Shift-wheel consumer, 2026-10-22

Continue Work `settings-sdk-publisher-audit-2026-09-26`, Movie Night #4/#5, existing PR #8 and shared intake #1347. The interrupted cube-controls implementation was recovered in place, not replaced. Reuse PR #7 / 28aca927's exact CenteredCarousel production class and base CSS, including the browser-rotated Shift+deltaX path. Regular vertical scrolling remains page-owned. Original donor evidence and earlier failures remain intact.

Manual creation now uses Source / Filters / Review, with Create cube above and Add another cube below the rows. Editing consumes the same query declaration, evaluator, cube ID, revision store and independent GET readback. This is a manual UI adoption, not a new store or BINS service. The source still uses metadata-source facets; availability, account entitlement and local playback capability are separate unimplemented provider boundaries. @ibal snapshot-collection save remains distinct from live-cube CRUD.

Additional hostile findings during reconciliation: the existing synthetic test clicked a recovery button behind an inert modal with JavaScript. The one recovery control now moves into the active dialog; a real pointer/keyboard test passes. A denied GET after a successful POST remains UNKNOWN, not a refused save. Unresolved writes disable repeat mutations and reconcile by reading only. Earlier post-save disabled-field failure is retained and corrected. The episode runner also accidentally inherited the real user's cube presentation; its fixture now supplies its own cube document without modifying user state or weakening episode assertions.

Current exact-source qualification: 65 top-level plus 16 player Python tests; donor input runner 15 checks; cube builder at 390/768/1440; full 461-ID synthetic episode-family plus five card widths. Existing real HTTP cube writer/cold-process readback passes in a disposable store. No private store or account write. Delivery remains an Aries TEST slice pending exact served-byte/browser readback, not main/Loki or physical-device acceptance.

Framework #1314 was independently read back closed unmerged; it is no longer a publication target. Preserve its donor tests under existing Ibal #80 and framework #476 obligations, without treating that PR closure as worker completion. #351/#426/#1237 and auth #344/#276 remain their owners' open gates.

## Episode-card details, 2026-10-22

Continue the same app writer, Work `settings-sdk-publisher-audit-2026-09-26`, #1/#3 and draft PR #8. No replacement player, metadata provider, BINS library or window component.

The existing metadata adapter already retained episode thumbnails, but the frontend discarded them. Actual Cinemeta episode names use `name` in the observed response, while our parser read only `title`; the fallback hid available episode names. The same allowlisted adapter now preserves names, art, finite episode ratings/runtime and explicit episode credits when supplied. Series cast is never asserted to be episode cast or guest appearances. The live Frankenstein Chronicles sample supplied 12 named episodes, 12 artwork URLs and 12 ratings, but no episode-specific cast/guests. Optional credits support is source-tested, not a newly connected credit provider.

Episode cards use an image/selection surface and a separate native disclosure for plot, rating and credits. Closed details are not part of the selection name and remain outside the exposed accessibility tree. Episode-scoped disclosure state and the optional Hide episode images control last in the mounted window, not a claimed cross-device settings save. The page owns vertical scrolling. Selection still cannot resolve a stream or play. Watched/resume labels project the existing library's exact episode history, never a parent series flag or a new store.

A paired server regression confirms missing/null/malformed `videos` was converted to an authoritative `episodes:[]`, then cached. Missing or entirely rejected data now stays incomplete and is not cached as success; an explicit empty array remains a real empty response. The same existing cache is retained. Reopening remains the normal retry route.

The existing browser runner now tests artwork/fallback, keyboard disclosure, accessible-name/tree leakage, selection separation, same-card/focus preservation under resize, 320px allocated width, episode-only history and spoiler state across refresh/reopen. Provider/player fixtures remain distinct from real served browser acceptance. No main merge, independent review, native player proof, BINS binding or Loki release follows from these checks.

## Universal series-card binding, 2026-10-22

Current owner correction: episode linkage is a product-wide card contract, not a list of individual shows to repair. Continue existing #1 / #3 / PR #8 and Work `settings-sdk-publisher-audit-2026-09-26`.

Every supported series card, whether from imported Library, Favorites, Recent, the catalogue, a saved cube, the detail carousel or a deep link, enters the same showFilm/loadFilmDetails path. Opening/reopening a series reads its hierarchy through the existing server metadata cache. It does not require an agent request, a title-specific patch, manual refresh, source lookup or playback. Missing/incomplete/failed metadata stays distinct from a successful empty episode list. The source candidate also preserves exact season/episode identity, including S00, into deliberate source/play/resume operations.

The prior Son of Zorn read was one diagnostic sample, not completion of episode linking. Current private-library census: 479 series occurrences, 461 distinct supported series IDs. Provider metadata was independently sampled for 12 different IDs and returned 2,616 correctly parent-bound episode records. This is metadata evidence, not 461 real-provider checks or stream/playback proof. The private census and receipt remain outside Git.

The existing episode/source browser runner now covers all entry paths, broad identifier sets, incomplete/empty/offline/wrong-series responses, automatic reopen recovery and stale replies. Its optional served-generation gate fails before browser testing when the actual Aries HTML/JS/CSS differ from the qualified candidate. Synthetic provider results are explicitly separate from live service readback. Existing draft #8 is not accepted main; native input, real playback, full BINS/session and canonical RETURN gates remain open.

## Earlier goal and next action (historical)
Accepted source: settings declaration/scoped reset at 7e26a30; provider-neutral Library and independent provider filtering at 6bbb760. Both were pushed to main and read back from GitHub. The next app increment is user-editable saved filter cubes rendered as stacked carousel rows, reusing the existing filter engine and saved-view data, with Wall/Carousel switching and persisted row order. Do not create playlists or a second shell. TV episode playback remains unimplemented. No random film launch.

## Current source and runtime
Source is adopted in place on Aries at ~/Documents/Personal-Movies/movie-night.
Private runtime remains the sibling movie-night-runtime directory. Wall: loopback 8789. Player adapter: loopback 18879. Port 8791 is not this deployment.
Existing native frame is reused from Studio, pin 94c49141a132ed00cdd72d0457911fc40523794f, with explicit local patches and donor provenance. No wholesale replacement.

## Ownership and shared settings
The owner's dot owns suite registration and OS settings. Registration is owner-reported saved. The 19-file OS settings patch is reported source-reviewed and tested, not installed. No exact patch/contract receipt is yet bound in this repo. Movie Night compatibility and deployment remain pending, not PASS.

## Evidence that must not be lost
Earlier settings UI run had desktop/tablet completion timeouts, while load-error recovery passed. Native resize had a later failing run; older passing evidence does not erase it. Glass has reported RGBA support but current user-visible transparency needs exact-build verification. Track these in the open-work ledger.

## Stop boundaries
Do not touch Nuvio settings/credentials; do not start films during tests; do not create another shell, settings registry, or suite registration. Do not reset the dirty framework checkout. Keep user library/history outside git.

## Current bounded evidence
See docs/ops/SELECTION-CONCIERGE-20261022.md. Browser tests use isolated storage and intercepted media routes. Local Ollama inference was real; native host commands in those browser tests were simulated. Settings-declaration consolidation, suite Work/CRM identity and AI Mail return qualification remain separate open obligations, not implied by these passes. No new suite audit or tracker has been created.

## Settings declaration increment, 2026-10-22
Python, React and the wall now consume xiio/settings.schema.json through the manifest. Scoped reset, import/export permissions and persistence use that declaration without changing movie-night.settings/v1. 32 isolated tests pass, including Python/browser validation parity and a fresh-process catalogue gate effect after save/reset; the shell build passes. These are not independent native restart qualification or shared Studio/DataForge registration. Provider filter and reusable filter-cube home views are the next app slice. Existing suite owners retain shared-frame, settings catalogue and chroma custody.

## Provider/filter increment, 2026-10-22
Nuvio is now a Provider facet, not a content/category tab. Library is a provider-neutral projection of existing records; imported source data and legacy saved-view/startup IDs are preserved. Provider, genre, title type and watch status intersect in the same wall/detail selection engine. YouTube/Prime/Netflix/Disney remain visibly not connected; source membership is not playback entitlement. Provider tests and existing selection-navigation tests pass at 1440/768/430 widths with no playback writes; 48 Python regressions pass. Shared Studio services, TV playback, full-catalogue service availability and persistent multi-row cube home remain distinct open work.

## Installed provider UI readback, 2026-10-22
The owned idle Movie Night service was restarted, and /api/settings/declaration returned 200 with the expected declaration identity. The native window ignored Ctrl+R; closing and reopening that app loaded the current assets. An app-only screenshot visibly confirms Your library, the separate Provider selector, and the retained right-side local Ollama/@ibal panel. The unsent draft was restored without sending it. Playback remained idle and original Nuvio configuration was not changed. This proves this displayed increment, not every settings effect after restart, new subscription integrations, shared Studio binding, or a completed cube home. Private runtime receipt: provider-filter-20261022/verification.json.

## Live filter-cube home increment
The cube increment consumes accepted settings and provider-filter main 6bbb760. It adds saved live queries, home carousel rows, one wall/carousel filter path, centred cached navigation and reversible layout editing. Source/browser checks and the clean shell build pass; exact installed acceptance is pending deployment readback. See docs/ops/FILTER-CUBES-20261022.md. Existing shared-services/OS/TV obligations remain open.

## Installed filter-cube home
541e572 is on GitHub main and Aries. The wall service and owned native app were reopened idle. Actual served assets match that source, and the native home/carousel/filter editor/right-side concierge are visually observed. The user's saved cube and active edits were preserved, with no seeded replacement and no media start. Full native saved-cube restart testing is deferred while the owner is editing; isolated fresh-process storage and browser reopen tests pass. See docs/ops/FILTER-CUBES-20261022.md. Next app work should start from this installed baseline, not rebuild the three-card canary.

## Title-detail review slice, 2026-10-22
Consumer width caps and movie-recommendation disclosure are repaired in source. verification/specimens/title-detail-specimen.html is the bounded state board for TV seasons/episodes and film recommendations, reusing CenteredCarousel and existing tokens. Review before extending the existing episode path. Browser source checks pass at 1920/1280/768/390. No new backend service, settings registry, chat engine or fake playback callback. Series playback remains OPEN: metadata omits episodes, UI guards series, adapter is movie-only. No native restart or episode playback proof. See docs/ops/TITLE-SPECIMEN-20261022.md.


## Manual-first UI and Bin delivery, 2026-10-23

Owner authorized Movie Night changes with the native app closed. Continue existing Work `settings-sdk-publisher-audit-2026-09-26`, #4/#5 and PR #8. This increment reconciles the installed discovery/Bin UI, retained episode/artwork consumer repair, newer published mini-player source and current navigation into one review candidate. It does not change the shared shell, account services, model configuration or user documents.

One navigation replaces the alternate Full workspace/advanced-layout presentation. My Bins has the single New Bin control; direct Edit, Rename and confirmed Remove reuse the existing revision writer. Arrange Bins retains a draft and blocks accidental navigation until saved/cancelled. View all and returning do not write the layout. New saves reveal the saved Bin in My Bins. Library and Bin title searches stay in their source instead of starting a global search. Ordinary filters and sort remain visible in Discover/Library; optional Bin filters, device-only filter presets, library sources and preferred-source playback use contextual disclosures. Watch is the primary action and still requires explicit source selection; no autoplay was added. Connected assistant recommendations are loaded only when explicitly expanded.

Retained personal_library.py correction reconciles missing title/artwork from same-type, same-parent records without replacing imported presentation, collapsing episode identities or changing progress. No reimport/migration is performed. Existing PR #8 mini-player geometry, track labels and controller protection are retained in the three-way source reconciliation, including the published module and asset route missing from the earlier installed overlay.

Verification: 96 application Python tests, 16 player tests, JavaScript syntax, server check and diff check pass in the complete-history review clone. Real HTTP Bin writes and separate reads pass at 390/768/1280px, including create/edit/rename/order/remove, refused write, landed-write/readback-unavailable reconciliation without a second write, cold page reopen and independent cold-process file readback. Keyboard Tab/Enter reaches New Bin; Escape closes the filter dialog. Recent episode selection/source lookup retains series/season/episode. No model calls. Catalogue and player are fixtures, not real media playback or native acceptance. Source bytes and delivery evidence remain in the existing private runtime.

Preserved failures: the first copied-source Python run lacked git history for its historical-contract check; the review clone resolves this without changing the test. The first browser run incorrectly reset a local copy of the cross-viewport player-call counter; the final test measures actual per-journey deltas. No application test was relaxed to hide a product failure. Existing owner tests and original pre-install bytes are retained.

Source publication, accepted main, installed readback and actual user acceptance remain separate. No independent expert/Ollama quorum, provider-wide playable catalogue, authorized BINS service, shared party/call or Article-template adoption is claimed. No merge or public-hosting cutover follows from this increment.
