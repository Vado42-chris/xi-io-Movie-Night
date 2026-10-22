# Selection and concierge increment, 2026-10-22

## Scope
Movie Night app source only. Existing Studio WindowFrame, ChatSnapControl, shared dock store and private library format are retained. No OS settings implementation, Nuvio installation, account credentials, external mail or other product source was changed.

## Implemented
- Full-content selection carousel with visible neighbors, explicit detail disclosure, previous/next buttons, keyboard, swipe and horizontal wheel support. No auto-advance. Reduced-motion is respected.
- Wall and selection route move the same filter controls, retaining search, genre, sort, advanced filters and saved-view handlers. Empty results cannot fall back to unrelated titles.
- Ask @ibal invokes the existing dock, reveals it on the right and retains the existing conversation. Model readiness and selected model are visible.
- Recommendations carry only bounded typed title identifiers to the local service. The service resolves metadata from existing server-owned catalogue/library state and rejects foreign or stale identifiers. No client-supplied title metadata is trusted.
- Proposals remain separate from explicit Save and Play. Existing private data schema is unchanged.

## Executed evidence
- Python application tests: 27 passed. Player tests: 16 passed. Catalogue self-tests: 12 passed at this source-family baseline.
- Selection navigation: desktop, tablet and phone passed shared-node identity, previous/next, keyboard, filtering, zero-result recovery, details disclosure, unchanged return state and overflow checks. Zero source/play writes.
- Existing title/source regression: desktop, tablet and phone passed. Player responses were intercepted synthetic fixtures, not real movie playback.
- Docked concierge: one visible right dock; real Ollama tags; actual local llama3.1:8b reply with two recommendations from 20 filtered titles; history/open state restored on page reload; dismissed state remained dismissed; one usable tablet chat. Native host commands were simulated.
- Production shell built using existing isolated dependencies. The external-drive node_modules launcher was not executable; the already-installed isolated Vite tool completed the build without changing machine mount permissions.

## Still open
Native installed-build readback and physical touch/trackpad interaction; TV episode selection/playback; manifest-driven settings deduplication and reset effect verification; exact suite Work/CRM/worker-return binding and AI Mail delivery. Browser/source checks do not close these obligations.
