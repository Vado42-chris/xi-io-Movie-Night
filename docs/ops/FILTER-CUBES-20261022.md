# Live filter cubes, 2026-10-22

## Behavior
The home renders saved filter cubes as vertically ordered centred carousel rows, with a wall/carousel switch over the same query. Cubes store source, provider, catalogue query, genre/year/type/watch-status filters and sorting, never movie membership. Both views call the same filterMovieQuery/matchesFilters implementation. Home and details reuse CenteredCarousel.

The selected cover remains centred. Arrow buttons, keyboard, pointer swipe and horizontal wheel loop through loaded matching titles in both directions. Ordinary vertical scrolling is preserved. Up to nine nearby covers per visible row are mounted; adjacent artwork is primed, and offscreen rows release their cover nodes. Equivalent online queries share a 24-query session cache with at most two requests in flight. More catalogue pages load incrementally using actual provider cursors. Loaded matches are labelled as loaded, not as the complete catalogue. Imported libraries remain snapshots until explicitly refreshed.

Edit home unlocks drag handles and Move up/down buttons. Add, rename, remove and reorder use a reversible draft with Save layout/Cancel. Row Filters opens the existing filter drawer. Save cube filters changes that row only. Removing a row removes its query, not titles, favorites, history, credentials or files. The idle player banner is hidden on carousel home; real playback controls remain available. App-linked chat receives the active cube name and selection.

## Storage and scope
filter_cubes.py owns one new private filter-cubes.json domain document beside the existing runtime files. Existing Nuvio, settings and library formats are unchanged. xiio/filter-cubes.schema.json defines strict document validation; jsonschema is declared in requirements.txt. Reads do not create state. Writes enforce private owner-only files, no symlink following, locking, revision compare-and-swap, atomic replace, fsync and readback. Unknown fields, duplicate identities, invalid origins, malformed documents and stale revisions are rejected. There is no 20-row cutoff; a 2 MiB document bound rejects an oversized save without truncation.

This is app-local query custody, not claimed DataForge/BINS registration or canonical Work authority. Shared frame, utility bindings, palette and TV playback are not repaired by this increment. No Entertainment hue is assigned.

## Reconciliation
Started from 7f696f04a71c4d924a77dbb609650db36ccecf12 in an isolated worktree. During development, the other app writer accepted settings consolidation at 7e26a30 and independent provider filtering at 6bbb760. This increment was rebased onto 6bbb7606d08a2bd0117d3aabb408f00646ffcd24, preserving both and adding provider-aware cube filtering. The original checkout's unrelated packaging/test edits remain outside this commit.

## Executed checks
The final combined source passed:
- Backend unit tests, including settings-contract parity, filter-cube persistence, 45 saved rows, fresh-process readback, conflict rejection and unrelated-file preservation.
- Existing player tests, with no actual media playback.
- Desktop/tablet/phone browser checks for centred nine-card rendering, wrap, independent rows, layout save/cancel/reorder, wall parity, reopen and no page-width overflow.
- Pointer drag, pointer swipe, keyboard, horizontal wheel, normal vertical scrolling, shared metadata cache, page loading, rename/remove cancellation, per-row filter updates and concurrent-window conflict retention.
- Existing title-selection and provider-filter browser regressions at all three widths. All media writes intercepted; zero playback writes.
- Clean candidate shell build. Root-disk test dependencies were used after a secondary-drive executable permission failure; no mounts or permissions were changed.

An initial legacy regression used an earlier test layout, and one rebase test run read the old service port before its restart completed. Both test-fixture defects were corrected; all final checks above executed successfully against the current service and combined source. Detailed logs/screenshots stay in private runtime custody.

Source/browser checks are not native touchscreen or independent-review proof. Installed exact-build readback is recorded after deployment. Advanced online filters apply to loaded metadata; no full-catalogue completeness claim is made.
