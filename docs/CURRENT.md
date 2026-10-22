# Current handoff

Date: 2026-10-22. State: active prototype; source preserved on main; selection and concierge increment tested, installation verification pending.

## Goal and next action
Source preservation and the full-title/explicit-source slice are on main at 679a157. The next tested increment adds a filtered selection carousel and the existing right-docked concierge, with real local Ollama responses. Publish this increment, install its shell assets, reopen only the idle owned app, and verify its native display. TV episode selection/playback remains unimplemented at this checkpoint. No random film launch.

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
