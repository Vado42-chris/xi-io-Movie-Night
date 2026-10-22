# Current handoff

Date: 2026-10-22. State: active prototype; settings and provider-filter source on main; provider UI visually read back in the reopened native app. Broader native and suite qualification remains open.

## Goal and next action
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
