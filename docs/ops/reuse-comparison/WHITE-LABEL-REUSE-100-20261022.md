# Independent white-label UX reuse opportunities, Movie Night lane

22 October 2026. **100 candidate opportunities, not 100 defects, implementations, products or adopted primitives.** This is an attachment to the existing Empire OS/XI-IO framework rebaseline. Candidate references below are document-local comparison labels, never Bugzilla IDs, Work IDs, assignments or qualified checklist cells.

This lane independently developed the opportunities from owner requirements, the supplied component audit and product matrix, and the current Movie Night source checkpoint. The other lane's 100-item set has not been consumed or compared. Independent authorship does not establish independent runtime verification.

## Scope, reuse and ordering

R1 comes first for duplication removal: window/layout, settings, selection identity and query semantics. R2 applies those foundations to repeated collections, chat, connections, editing and state. R3 composes them into lifecycle, publishing and collaboration. This is a qualitative ordering, not a measured savings claim or severity ranking. Authorization, data loss and false-effect defects remain release gates regardless of the reuse order.

Each proposal means recover and use the accepted implementation first, extend it at its existing owner only when necessary, and test every affected consumer. A named reference is a source lead, not proof of universal portability or current installation. Product-specific recommendation algorithms, entitlement, playback, persistence engines, permissions, legal semantics and workflow effects remain domain-owned.

The five-consumer adoption matrix is intentionally separate and unchanged. No pass/fail values are generated from this list. Public websites inherit applicable semantics and tokens, not an imposed desktop utility rail or identical branding.

## Source basis

- Owner-provided `XI-IO-component-audit-20261022.md`, 65 typed review entries, not 65 completed products. The inspected audit uses Node receiving source `b6fcdf1eaf25db7fd97f8be5f3e6abced6608f18` and explicitly marked successor candidates. Its source observations are not fresh runtime reproductions here.
- Owner-provided `products.csv`, preserving actual product, editor-mode, framework, supporting-surface and public-site distinctions. Candidate consumer examples below do not upgrade its assessment states.
- Movie Night checkout observed at `c723453e9b216456fe8b0a9031516e06c20563a9`. Existing width/specimen work, filter cubes and settings source are prior evidence, not a suite pass.
- Accepted framework source read for this lane: `f2976548b09743f0d54c308c44a71be30752152f`. The five skills in the existing app framework lock were recovered. Runtime assignment, BINS custody and parent return joins are not manufactured by that read.
- Existing framework issue #358 owns UI applicability/evidence qualification, #394 derives primitive-family health from existing owners, and #401 owns heuristic applicability and evidence lineage. These were read in this pass. They are linkage leads, not newly assigned mutation owners or recovered Bugzilla IDs.

## The 100 opportunities


### 1. Window geometry and universal utilities [R1]

One host geometry and utility implementation replaces app-specific chrome, sizing rules and entrypoint wiring.

Existing reference leads: `WindowFrame.jsx`, `windowRail.css`, `windowScroll.css`, `SettingsEntryContext.jsx`, `settingsEntry.mjs`.


**MN-REUSE-001 · Available-width layout**

Use the content region left after the rail and contextual dock, without inherited narrow-page caps.

Consumers: Movie Night, Marketplace, BINS. Verification probe: Resize with chat open and closed; content fills its allocated region without overlapping chat.


**MN-REUSE-002 · Readable text inside wide layouts**

Separate paragraph reading measure from the width available to cards, tables, timelines and inspectors.

Consumers: sam_law, Articles, WordPress. Verification probe: A long paragraph remains readable while its neighbouring collection uses all available width.


**MN-REUSE-003 · One scroll owner per region**

Declare whether the document, canvas or list owns scrolling; do not nest accidental scroll traps.

Consumers: Office, BINS, Movie Night. Verification probe: Wheel and touch move the intended region; header and controls remain reachable.


**MN-REUSE-004 · Permanent lower-left utilities**

Reuse the existing BINS, @ibal and Settings utility zone, separate from window-management controls.

Consumers: All desktop plugins, standalone apps. Verification probe: All three are reachable in a short window and narrow layout, with labels and visible focus.


**MN-REUSE-005 · Adaptive dock sizing**

Respect minimum content and chat sizes; use the accepted narrow-screen presentation when both cannot fit.

Consumers: Movie Night, Inbox, sam_law. Verification probe: Narrow and widen the host without losing selection, draft, focus or reachable controls.


**MN-REUSE-006 · Native versus virtual frame adapter**

Keep one frame rendering contract with host-specific move, resize, minimize and maximize bindings.

Consumers: Movie Night, Arcade, Inbox. Verification probe: Native controls operate the actual window; virtual controls operate only their owned pane.


**MN-REUSE-007 · Geometry recovery**

Restore saved position and size relative to current displays, not obsolete coordinates.

Consumers: Office, BINS, Repo Reaper. Verification probe: Reopen after removing a display; the full title bar and recovery controls remain reachable.


**MN-REUSE-008 · Fullscreen state preservation**

Enter and exit fullscreen without changing the selected resource, conversation or unsaved work.

Consumers: Movie Night, Arcade, Presentations. Verification probe: Toggle fullscreen twice and compare resource identity, draft and return geometry.


**MN-REUSE-009 · Focus restoration**

Return focus to the originating item after details, dialogs or context panels close.

Consumers: Marketplace, BINS, Work views. Verification probe: Keyboard-open a detail view, close it and continue from the same item without restarting navigation.


**MN-REUSE-010 · Declared rail extensions**

Place product tools in existing rail slots while universal utilities remain owned by the shared frame.

Consumers: Movie Night, Inbox, WordPress. Verification probe: Each action appears once; consumer tools cannot displace or duplicate shared utilities.


### 2. Declaration-driven settings and preferences [R1]

One declaration and interpreter remove duplicate defaults, allowed-value lists and hand-written settings metadata.

Existing reference leads: `SettingsSurface.jsx`, `SettingPrimitive.jsx`, `SettingControl.jsx`, `SettingDetail.jsx`, `settingsFamilies.mjs`, `Movie Night xiio/settings.schema.json`.


**MN-REUSE-011 · Full catalogue at the caller**

Open the complete settings catalogue at the requesting app or document section, never an app-only substitute.

Consumers: Movie Night, Marketplace, Office. Verification probe: Open from two apps; initial sections differ but the same authorized catalogue remains available.


**MN-REUSE-012 · Declared control types**

Render boolean, choice, range, order and text controls from the declared type, not the current value.

Consumers: Theme, Desktop, account preferences. Verification probe: An unset or null value cannot silently turn a choice or boolean into free text.


**MN-REUSE-013 · One default resolver**

Derive default and fallback values from one versioned declaration across UI and persistence.

Consumers: Movie Night, Inbox, account preferences. Verification probe: A missing preference produces the same value in the panel, validator and actual consumer.


**MN-REUSE-014 · Validation parity**

Apply the same declaration at every trust boundary without maintaining separate allowed-value lists.

Consumers: Theme import, Movie Night, product manifests. Verification probe: Run identical valid, invalid and unknown-field fixtures through every entrypoint and compare outcomes.


**MN-REUSE-015 · Scope and inheritance disclosure**

Show user, device, workspace, app or document ownership and whether a value is inherited or overridden.

Consumers: Office, Desktop, sam_law. Verification probe: Reset an app override without changing the device or document value; disclose the effective result.


**MN-REUSE-016 · Preview and cancel**

Treat previews as reversible presentation, not silently persisted preferences or privileged effects.

Consumers: Theme, Movie Night, Publisher. Verification probe: Preview, cancel and reopen; both actual behaviour and stored preference return to their prior state.


**MN-REUSE-017 · Save with effect readback**

Distinguish saved bytes from an applied setting and from restart-qualified behaviour.

Consumers: Movie Night, Office, Inbox. Verification probe: Save, close and reopen; verify the declared consumer effect, not merely the stored value.


**MN-REUSE-018 · Scoped reset preview**

Show exactly which declared values reset and which unrelated settings and files remain untouched.

Consumers: Desktop, Movie Night, WordPress. Verification probe: Reset one section, verify defaults and unchanged sibling preferences, then reopen and verify effects.


**MN-REUSE-019 · Independent import and export policies**

Honour each declared import, export and reset policy independently, with validation before applying data.

Consumers: Settings, BINS preference transfer, Office. Verification probe: Import-only and export-only declarations work independently; denied operations cannot mutate state.


**MN-REUSE-020 · Unavailable setting explanation**

Show missing declarations, permissions or adapters as specific unavailable states, not enabled decorative controls.

Consumers: Native device controls, providers, document settings. Verification probe: Remove a required binding; the panel explains the missing capability and sends no fake success callback.


### 3. Record identity, selection and action boundaries [R1]

A stable selection contract eliminates separate card/list/detail identities and prevents accidental domain effects.

Existing reference leads: `SystemCard/SystemNav in SystemComponents.jsx`, `Article template slots`, `Movie Night CenteredCarousel`, `SelectedThreadReader.jsx`.


**MN-REUSE-021 · Typed resource identity**

Carry a domain-qualified identity through every projection instead of using labels or list indexes as identity.

Consumers: Movie Night, BINS, Marketplace. Verification probe: Two same-titled records remain distinct across sorting, rendering changes and detail navigation.


**MN-REUSE-022 · Parent-child identity**

Retain the parent and child tuple during selection and action, including valid zero-valued children such as specials.

Consumers: TV seasons and episodes, document sections, Work attempts. Verification probe: Change parent while a child is selected; stale child actions are rejected and the selection is cleared or rebound.


**MN-REUSE-023 · Revision-bound selection**

Bind selection to the relevant record version or source generation rather than silently following a changed head.

Consumers: BINS, Office, Repo Reaper. Verification probe: Update a selected resource elsewhere; show the change and require explicit reconciliation before version-sensitive effects.


**MN-REUSE-024 · Selection is not execution**

Keep highlight, inspect and activate separate from play, purchase, install, publish or run.

Consumers: Movie Night, Marketplace, Cadence. Verification probe: Mouse, keyboard and swipe selection cause zero domain-effect requests.


**MN-REUSE-025 · Nested action isolation**

Prevent a favorite, checkbox, menu or remove action inside a card from also activating the card.

Consumers: Inbox, Marketplace, BINS. Verification probe: Activate every nested control by keyboard and pointer; only its intended action fires once.


**MN-REUSE-026 · Keyboard card semantics**

Give selectable and activatable cards the appropriate focus, role and keyboard behaviour.

Consumers: Marketplace, BINS, Movie Night. Verification probe: Navigate, select and open using the keyboard; preserve focus and expose disabled states correctly.


**MN-REUSE-027 · Capability-gated primary action**

Derive action availability from the relevant qualified capability and authorization, not metadata presence.

Consumers: Ward, Marketplace, Movie Night. Verification probe: A listed title or plugin with no callable effect cannot offer an apparently working Play or Install action.


**MN-REUSE-028 · Selection-scoped batch action**

State whether an action applies to selected records, loaded results or the whole matched set.

Consumers: BINS, Inbox, Work queues. Verification probe: With unloaded pages present, the confirmation and effect use exactly the declared selection scope.


**MN-REUSE-029 · Stable selection after removal**

Reconcile the selected item when it disappears without selecting an unrelated record for an existing action.

Consumers: Inbox, BINS, Marketplace. Verification probe: Remove the focused row; focus moves predictably and any pending action stays bound to its original identity.


**MN-REUSE-030 · Explicit destination selection**

Display the actual account, device, site or recipient that will receive an action, distinct from the viewing host.

Consumers: Publisher, Calendar, Movie Night. Verification probe: Switch destination and cancel; no operation reaches the previous target or an inferred default.


### 4. Search, provider facets and query semantics [R1]

One predicate and query model removes inconsistent search, wall, carousel, saved-view and count implementations.

Existing reference leads: `SearchLanding.jsx`, `SearchForge.jsx`, `CanonicalSearch.jsx`, `SDK search-field/search-band references`, `Movie Night filterMovieQuery/matchesFilters`.


**MN-REUSE-031 · Source is not content category**

Keep provider, account or repository separate from genre, file type or plugin category.

Consumers: Movie Night, BINS, Marketplace. Verification probe: Combine provider and category; changing one preserves and intersects the other.


**MN-REUSE-032 · Multi-account source scope**

Distinguish two accounts at one provider and keep each query inside its authorized source scope.

Consumers: Inbox, BINS, Calendar. Verification probe: Identical folder or mailbox names in different accounts never merge or leak results.


**MN-REUSE-033 · Composable predicates**

Reuse declared AND, OR, exclusion, date and range semantics rather than per-view filter code.

Consumers: Movie Night, Search, Work queues. Verification probe: The same query returns the same identity set in wall, list, carousel and saved-view evaluation.


**MN-REUSE-034 · Unknown filter preservation**

Preserve unsupported or disconnected filter values as explicit unresolved conditions instead of broadening to All.

Consumers: Movie Night, BINS, Marketplace. Verification probe: Load a saved query for an unavailable provider; show the restriction and do not return unrelated sources.


**MN-REUSE-035 · Reversible filter chips**

Show active constraints and remove one without clearing unrelated predicates or source scope.

Consumers: Search, Movie Night, Inbox. Verification probe: Remove a genre or status chip; the remaining account, year and query constraints stay intact.


**MN-REUSE-036 · Explicit search coverage**

Label whether the query covers loaded records, a local index or a provider-wide search.

Consumers: Search, Movie Night, BINS. Verification probe: Filter a partial page and verify that counts and empty states do not claim global completeness.


**MN-REUSE-037 · Saved queries rather than copied results**

Store filter definitions and sorting as live views while keeping manually curated membership a separate domain concept.

Consumers: Movie Night, BINS, Work views. Verification probe: Change underlying records; the saved query updates without rewriting a playlist or collection membership.


**MN-REUSE-038 · Query reset with declared scope**

Reset filters separately from source selection, saved-view deletion or account disconnect.

Consumers: Search, BINS, Marketplace. Verification probe: Clear filters and verify no saved cube, file or provider connection was removed.


**MN-REUSE-039 · Identity-stable sorting**

Apply stable tie-breaking and preserve the selected identity when sort order changes.

Consumers: Movie Night, BINS, Benchmark. Verification probe: Sort tied records repeatedly; selection remains on the same resource, not the same index.


**MN-REUSE-040 · Query share and clone boundaries**

Copy or share the query definition with provenance, never credentials or implied access to its results.

Consumers: Movie Night, Work views, Search. Verification probe: Open a shared query as a second user; unavailable sources remain restricted and no private results are embedded.


### 5. Collections, navigation and efficient repeated content [R2]

Shared collection behaviour removes independent pagination, carousel, row-ordering and return-navigation implementations.

Existing reference leads: `CubeShelf.jsx`, `SystemCard`, `Movie Night CenteredCarousel`, `Movie Night mountFilterCubes`, `existing search/result controls`.


**MN-REUSE-041 · Identity-preserving view switch**

Switch wall, list, carousel or table presentation without replacing query, selection or resource identity.

Consumers: Movie Night, Marketplace, BINS. Verification probe: Change view twice; filters and selected identity are unchanged, with a predictable scroll anchor.


**MN-REUSE-042 · Centred active-item navigation**

Reuse centred selection with neighbouring items and explicit open behaviour rather than a separate engine per catalogue.

Consumers: Movie Night, Arcade, template browser. Verification probe: Arrows, pointer and keyboard select the same next identity; centred activation opens details without running it.


**MN-REUSE-043 · Directional gesture ownership**

Distinguish horizontal collection gestures from vertical page scrolling and zoom gestures.

Consumers: Movie Night, BINS shelves, Marketplace. Verification probe: Vertical scrolling and pinch/zoom remain available while horizontal gestures navigate only the active row.


**MN-REUSE-044 · Bounded rendering**

Virtualize large collections while retaining logical focus and screen-reader position information.

Consumers: Movie Night, Marketplace, BINS. Verification probe: Browse a large fixture without mounting every card or losing focus when an item leaves the rendered range.


**MN-REUSE-045 · Query-keyed cache reuse**

Share equivalent result requests only within the same authorization scope, query and source generation.

Consumers: Search, Movie Night, BINS. Verification probe: Two identical authorized queries reuse data; changed account, scope or generation does not reuse private results.


**MN-REUSE-046 · Cursor-aware continuation**

Follow provider continuation tokens rather than deriving the next page from visible item counts.

Consumers: Movie Night, Inbox, BINS. Verification probe: Empty sanitized pages and duplicate records do not skip, repeat indefinitely or terminate a valid continuation.


**MN-REUSE-047 · Honest ends and refresh**

Distinguish finite results, locally wrapped navigation, loading more and genuinely exhausted sources.

Consumers: Movie Night, Marketplace, Search. Verification probe: Wrap a local carousel and exhaust a provider feed; labels never imply undiscovered items are already cached.


**MN-REUSE-048 · Editable vertical row layout**

Unlock row order with drag and keyboard alternatives, plus reversible save and cancel.

Consumers: Movie Night, BINS, Work dashboards. Verification probe: Reorder rows, cancel, then save a second arrangement; reopening matches only the saved order.


**MN-REUSE-049 · Per-row filter editing**

Bind the shared filter editor to one row and distinguish saved row rules from temporary page filters.

Consumers: Movie Night, BINS saved searches, Work dashboards. Verification probe: Edit one row; every other row keeps its original query and order.


**MN-REUSE-050 · Return-navigation restoration**

Restore the originating query, item and scroll anchor after detail or secondary navigation.

Consumers: Movie Night, Marketplace, BINS. Verification probe: Open details, inspect a related item and return; the original collection remains recognizable and navigable.


### 6. Contextual chat and assistant interaction [R2]

One existing conversation engine can serve docked, detached and standalone hosts without duplicating chat state.

Existing reference leads: `WindowChatBay.jsx`, `WindowChatLanes.jsx`, `ChatComposer.jsx`, `ChatTranscript.jsx`, `Attachments.jsx`, `ChatSnapControl.jsx`, `chatDockStore`.


**MN-REUSE-051 · App-scoped right dock**

Bind the existing chat outside the content region to the calling window, user and current selection.

Consumers: Movie Night, Inbox, sam_law. Verification probe: Open two app windows and change selection in one; the other conversation context remains isolated.


**MN-REUSE-052 · Visible context envelope**

Show which app, selected records and scope the assistant is using, with an explicit clear or switch action.

Consumers: @ibal, BINS, Work views. Verification probe: Change the selected source; the next request carries the displayed context rather than an obsolete selection.


**MN-REUSE-053 · Actual chat detachment**

Move the same conversation into a real host window where supported, not a floating div labelled Undock.

Consumers: Movie Night, Office, Inbox. Verification probe: Detach and inspect the host window identity; history, draft and context remain bound to the same conversation.


**MN-REUSE-054 · Recover closed detached chat**

Reopen or focus the existing conversation from the permanent @ibal utility after its detached window closes.

Consumers: Movie Night, Marketplace, sam_law. Verification probe: Close detached chat and reopen it; no duplicate conversation or lost draft is created.


**MN-REUSE-055 · Draft continuity across presentation**

Preserve unsent text and attachments across dock, detach, minimize and reopen transitions.

Consumers: @ibal, Inbox assistant, Office assistant. Verification probe: Change presentation with an unsent draft; its content survives and no message is sent.


**MN-REUSE-056 · Proposal versus authorized action**

Present suggestions and previews separately from user-approved execution.

Consumers: @ibal, Cadence, Repo Reaper. Verification probe: A generated list, patch or workflow proposal cannot trigger save, send or run until its explicit action is authorized.


**MN-REUSE-057 · Truthful message lifecycle**

Present pending, delivered, failed and acknowledged states from real receipts rather than one optimistic Sent state.

Consumers: @ibal, AI Mail, Inbox. Verification probe: Timeout a send; preserve its uncertainty and prevent retry from silently duplicating the message.


**MN-REUSE-058 · Shared attachment picking**

Use the authorized BINS picker and preserve resource references, revisions and permission scope.

Consumers: @ibal, Inbox, sam_law. Verification probe: Attach a file and revoke access before sending; no unauthorized bytes enter the message.


**MN-REUSE-059 · Optional assistant onboarding**

Reuse the declared provider/model setup flow while keeping non-AI browsing and editing usable.

Consumers: Movie Night, Arcade, Office. Verification probe: Start with no AI connection; core tasks work and setup explains the exact missing capability.


**MN-REUSE-060 · Long response and failure recovery**

Reuse streaming, cancellation, retry and partial-response presentation without replacing the conversation engine.

Consumers: @ibal, Benchmark, Work views. Verification probe: Cancel a response, retain the useful partial text and retry without duplicating prior domain actions.


### 7. Connections, authorized libraries and import workflows [R2]

A shared connection and BINS workflow avoids per-product account pickers, import stores and inconsistent access checks.

Existing reference leads: `ProviderConnect.jsx`, `Integrations.jsx`, `IntegrationDashboard.jsx`, `FileManager.jsx`, `BinEntryRow.jsx`, `BinFileView.jsx`, `existing Ward reader boundary`.


**MN-REUSE-061 · Capability-labelled connection setup**

Declare whether a connection supports discovery, import, preview, sync, deep linking or native action.

Consumers: Movie Night, BINS, Inbox. Verification probe: Connect a catalogue-only provider; the UI does not claim playback or write access.


**MN-REUSE-062 · Scoped authorization explanation**

Show requested account access, purpose and approved scope through the existing connection flow.

Consumers: BINS, Calendar, WordPress. Verification probe: Decline a scope; unrelated functions remain available and no extra permission is inferred.


**MN-REUSE-063 · Account and endpoint chooser**

Reuse setup and testing presentation with provider-owned URL, authentication and trust validation.

Consumers: Ollama setup, Plex connection, remote repositories. Verification probe: Select a different configured endpoint; test results identify that endpoint without exposing credentials.


**MN-REUSE-064 · Connection-test readback**

Distinguish configured credentials, reachable service and usable required capability.

Consumers: Movie Night, BINS, Ward. Verification probe: A healthy endpoint missing the required feature produces a specific partial/unavailable result, not Connected-and-ready.


**MN-REUSE-065 · Expiry and reconnect**

Reuse expired, revoked, offline and reconnect states while preserving selected files and unfinished work.

Consumers: Inbox, BINS, Calendar. Verification probe: Expire a connection mid-task; reconnect returns to the same safe task state without copying credentials into UI state.


**MN-REUSE-066 · Scoped BINS entry**

Open the existing authorized library at the caller's app/work context without moving or duplicating its files.

Consumers: Movie Night, Office, sam_law. Verification probe: Open BINS from two apps; initial scope differs, custody is unchanged and authorization is rechecked.


**MN-REUSE-067 · Reference versus import choice**

Explain link/reference, local copy, metadata import and synchronization as distinct operations.

Consumers: Movie Night, BINS, WordPress. Verification probe: Preview each supported operation; only the explicitly chosen operation changes the declared destination.


**MN-REUSE-068 · Import preview and conflict policy**

Reuse count, mapping, duplicate and conflict review before applying supported imports.

Consumers: Nuvio snapshots, BINS, contact imports. Verification probe: Run an import twice; the declared merge policy preserves overrides and reports duplicates without silent loss.


**MN-REUSE-069 · Revocation-safe previews**

Make preview, download and export consume the same authorized reader and revoke cached access appropriately.

Consumers: BINS, sam_law, Office. Verification probe: Revoke permission during a read; no later path exposes private bytes from stale authorization.


**MN-REUSE-070 · Disconnect without unintended deletion**

Separate revoking a connection from deleting imported records, user files or saved preferences.

Consumers: Movie Night, BINS, Inbox. Verification probe: Disconnect a provider; explain retained data and require a separate explicit operation for deletion.


### 8. Editing, persistence and reversible operations [R2]

Shared edit-session and command-state semantics remove inconsistent Save, Cancel, reset, conflict and export handling.

Existing reference leads: `SystemFileFrame`, `SystemFileBar`, `DocumentEditor.jsx`, `WordPressEditor.jsx`, `CanvasBoard`, `PublicationReadback.jsx`.


**MN-REUSE-071 · Shared dirty-state contract**

Track committed versus draft values without mistaking delayed server hydration for a user edit.

Consumers: Office, WordPress, Movie Night layouts. Verification probe: Open before data arrives; untouched values stay clean and genuine edits stay dirty.


**MN-REUSE-072 · Local undo and redo**

Reuse undo interaction while each domain owns valid inverse operations and irreversible boundaries.

Consumers: Office, VectorFORGE, layout editing. Verification probe: Undo a local edit without undoing an external publish or another user's action.


**MN-REUSE-073 · Concurrent-edit conflict**

Preserve revision checks and unsaved drafts when another window saves first.

Consumers: Settings, Office, filter cubes. Verification probe: Submit a stale revision; retain the draft, show conflict and do not overwrite the winner.


**MN-REUSE-074 · Autosave feedback**

Show draft, saving, saved and failed states tied to the actual revision and save response.

Consumers: Articles, Resume, WordPress. Verification probe: Delay and fail autosave; the UI never reports the unsaved revision as persisted.


**MN-REUSE-075 · Saved-revision preview**

Bind preview to a known revision and disclose when it shows unsaved changes instead.

Consumers: Office, Publisher, sam_law. Verification probe: Save, reopen and preview; compare the actual artifact revision and content, not a cached screenshot.


**MN-REUSE-076 · Command separation**

Keep Save, Save as, Export, Share and Publish as distinct commands with distinct destinations and effects.

Consumers: Office, Publisher, BINS. Verification probe: Invoke each supported command; its result and authorization do not imply the others completed.


**MN-REUSE-077 · Drag-to-commit binding**

Make drag-end produce a real domain change or a clearly reversible local draft, never a no-op callback.

Consumers: Canvas authoring, presentations, cube layouts. Verification probe: Drag an item, save and reopen; the persisted order or geometry matches the committed operation.


**MN-REUSE-078 · Deletion-scope confirmation**

Identify whether removal affects a view, item reference, local copy, application or underlying source.

Consumers: BINS, Marketplace, Office. Verification probe: Remove a home row or plugin shortcut; underlying content remains unless explicitly included in the action.


**MN-REUSE-079 · Export fidelity report**

Report unsupported fields or blocks before export instead of silently omitting them.

Consumers: WordPress, Office, Articles. Verification probe: Export a mixed-content fixture and compare preserved identities, fields and declared losses.


**MN-REUSE-080 · Recovery after interruption**

Recover a staged draft or failed transaction without replaying an uncertain external effect.

Consumers: Repo Reaper, document editors, settings. Verification probe: Interrupt between request and acknowledgement; reopen with a recoverable state and no duplicate mutation.


### 9. Truthful state, provenance and accessibility [R2]

Consistent state and evidence primitives remove repeated ambiguous spinners, false greens and inaccessible recovery controls.

Existing reference leads: `SDK Surface/Note/Unobserved/Chip/Readout`, `ShiftTruth.jsx`, `ShiftStrip.jsx`, `shiftRunReading.mjs`, `HeadlessDispatchControl.jsx`, `queueDispatchOutcome.mjs`.


**MN-REUSE-081 · Distinct empty and unavailable states**

Differentiate no matches, no data, not loaded, disconnected and permission-denied results.

Consumers: Movie Night, BINS, Search. Verification probe: Exercise each state; the message and recovery action match the cause without leaking hidden records.


**MN-REUSE-082 · Visible stale-data age**

Label cached or stale results with source generation and freshness rather than presenting them as current.

Consumers: Movie Night, Work views, Benchmark. Verification probe: Disconnect after loading; existing results remain inspectable but visibly stale where applicable.


**MN-REUSE-083 · Cancelled-request isolation**

Ignore late results for a previous query, parent record or permission scope.

Consumers: Search, TV episodes, document previews. Verification probe: Rapidly switch series or document; delayed responses cannot replace the current view.


**MN-REUSE-084 · Honest progress and denominators**

Show indeterminate progress when totals are unknown and exact denominators only when established.

Consumers: BINS imports, installs, Work runs. Verification probe: Remove total-count evidence; the UI does not fabricate a percentage or completion.


**MN-REUSE-085 · Readable evidence drilldown**

Pair a human-readable status with inspectable source, generation, command and readback references.

Consumers: Ward, Benchmark, Repo Reaper. Verification probe: Trace a claim to its actual evidence; a missing receipt stays unresolved rather than yielding a green badge.


**MN-REUSE-086 · Work-stage fidelity**

Preserve queued, delivered, acknowledged, executing, returned and independently verified states.

Consumers: Switchboard, Cadence, AI Mail. Verification probe: End an agent run without an accepted return; parent Work does not become completed.


**MN-REUSE-087 · Uncertain-outcome recovery**

Distinguish failure from unknown outcome and check existing operation identity before offering retry.

Consumers: Marketplace, publishing, Work dispatch. Verification probe: Lose the response after an effect; recovery avoids duplicate purchase, publish or dispatch.


**MN-REUSE-088 · Non-colour status meaning**

Keep text and icons for status independent of product-family hue and user theme.

Consumers: Ward, Marketplace, all themed views. Verification probe: Neutral, dark, light and unassigned-colour presentations retain the same readable status meaning.


**MN-REUSE-089 · Reduced-motion and large-text behaviour**

Reuse declared accessibility preferences without losing navigation, clipping actions or forcing animation.

Consumers: Movie Night, AuDHD Field Guide, Office. Verification probe: Increase text and reduce motion; all core controls remain operable and essential states visible.


**MN-REUSE-090 · Accessible error recovery**

Associate errors with their controls and return keyboard focus to the relevant fix without clearing valid input.

Consumers: Settings, BINS, provider setup. Verification probe: Submit one invalid field; announce the error, preserve other fields and complete correction by keyboard.


### 10. Plugin lifecycle, white-label publishing and collaboration [R3]

Once foundational contracts pass, one set of lifecycle and composition surfaces scales to many products and sites.

Existing reference leads: `appLifecycle.mjs`, `AddonManager.jsx`, `ArticleTemplates`, `ArticleTemplateCard`, `Publisher template/slot references`, `OfficeSuite.jsx`, `existing contacts/invitation surfaces`.


**MN-REUSE-091 · First-run capability checklist**

Assemble onboarding from real declared prerequisites rather than machine-specific instructions or invented readiness.

Consumers: Movie Night, Arcade, Inbox. Verification probe: On a fresh profile, each required capability has a truthful setup action and optional capabilities can be skipped.


**MN-REUSE-092 · Install-state separation**

Distinguish listed, entitled, installed, configured, runnable and update-eligible states.

Consumers: Marketplace, desktop launcher, Settings Applications. Verification probe: A catalogue entry without an installed runtime cannot be labelled Launch-ready.


**MN-REUSE-093 · Update and rollback review**

Reuse version, permission-change, compatibility and recovery presentation around existing installers.

Consumers: Marketplace, Ward, Office plugins. Verification probe: Review an update requiring new scope; cancelling changes neither the installed generation nor user data.


**MN-REUSE-094 · Removal with retained work**

Separate app removal and future-update eligibility from access to retained work and existing entitled capability.

Consumers: Marketplace, BINS, standalone plugins. Verification probe: Unsubscribe or remove a plugin under its declared policy; show what remains and verify the declared data retention.


**MN-REUSE-095 · White-label semantic slots**

Render shared title, description, provenance, actions and related-item slots with target-specific styling.

Consumers: Articles, Publisher, Marketplace, public sites. Verification probe: Two branded targets preserve the same semantic identities and action meaning without copying component logic.


**MN-REUSE-096 · Source-labelled related content**

Share recommendation-section states and presentation while each product owns ranking, eligibility and explanation.

Consumers: Movie Night, Marketplace, Articles. Verification probe: A local related-item set is labelled as such; no recommendations is explicit and does not fabricate global coverage.


**MN-REUSE-097 · Schema-derived template inspector**

Populate required slots, allowed options and missing-binding explanations from the selected template declaration.

Consumers: Articles, Office, WordPress. Verification probe: Change template versions; inspector and validator agree without a separate hand-written field list.


**MN-REUSE-098 · Target preview and publish readback**

Preserve the target identity, revision, path and accepted generation from preview through verified publication.

Consumers: Publisher, WordPress, xi-io sites. Verification probe: Publishing to one target cannot overwrite another domain; preview alone never marks a site deployed.


**MN-REUSE-099 · Participant and invitation states**

Reuse participant picking and pending/accepted/declined/expired states through existing collaboration contracts.

Consumers: Movie Night, Calendar, RealityPools. Verification probe: Sending or queuing an invite does not imply delivery, acceptance, content entitlement or attendance.


**MN-REUSE-100 · Session readiness and recovery**

Reuse lobby, ready, disconnected, rejoin and leave presentation while each domain owns synchronization and access rules.

Consumers: Movie Night watch parties, Arcade, shared Work sessions. Verification probe: A reconnect preserves session identity; guests without required access cannot inherit the host's credentials or privileges.


## Compare the two candidate sets before A/B testing

1. Preserve both original lists and their source versions. Match opportunities by behaviour, scope and failure mode, not wording. Mark overlap, complementary scope, conflict, donor already covers it, or still unknown. Never create two implementations because two agents named the same requirement differently.
2. Use existing canonical owner and relationship references to decide reuse, adapter correction, shared extension or genuinely domain-local behaviour. A source search miss is not proof a donor does not exist. A required missing behaviour gets implemented at the appropriate owner rather than permanently blocked on donor discovery.
3. Separate non-negotiable gates from design alternatives. Identity fidelity, authorization, persistence, honest state, keyboard access, safe reset and no unintended effects must hold in both variants. Compare compliant representations, not a safe implementation against a broken one.
4. For an actual A/B trial, vary one interaction at a time while holding dataset, query, entitlement, source generation, host and task constant. Counterbalance A/B order. Record task completion, errors, wrong-target attempts, recovery steps, manual explanations and user preference. Record duplicate definitions/import paths before and after separately from usability observations. No fabricated statistics or significance claims.
5. Preserve failures and disagreements. A useful trial can be inconclusive. The opportunity set itself has no experiment results and does not count as the five-consumer evidence matrix.

### First comparative trials to map into the existing specimen board

These are proposed variants under the same contracts, not new application screens or requested backend implementations.

| Trial | A versus B, both contract-compliant | Task and evidence |
|---|---|---|
| Related-item disclosure | Visible compact row versus visible expanded row | Find a useful next item, record time, scroll and correct action; ranking and dataset stay identical. |
| Filter editing | Compact summary plus drawer versus compact summary plus inline editor | Change provider and year without losing other constraints; compare task errors and recovery. |
| Cube row organization | Drag handles with always-visible move controls versus drag handles with labelled overflow move controls | Reorder by pointer and keyboard, cancel, save and reopen; both support non-drag input. |
| Connection setup | Capabilities-first setup versus task-first guided setup | Connect the correct account and understand unsupported capabilities; no fake OAuth or adapter callbacks. |
| Settings reset review | Inline before/after values versus a dedicated confirmation surface | Identify exactly what will reset; both use the same declared scope and defaults. |
| Action readiness | Visible reason beneath the action versus a labelled status-and-reason disclosure | Explain why play/install/publish is unavailable; disabled semantics and backend state remain identical. |
| Context disclosure | Persistent concise context chip versus persistent context summary with expansion | Identify which window, resource and account the assistant will use; both expose and permit correcting context. |
| Work progress | Compact stage strip versus compact stage list with expandable evidence | Distinguish queued, acknowledged, executed and verified, using the same real or clearly labelled fixture states. |

### Five-consumer probes, not a second adoption matrix

Use the existing owner's actual consumer identities and cells; do not replace them with these shorthand labels.

| Consumer surface | Proposed end-to-end task | Domain boundary |
|---|---|---|
| Movie Night | Change provider and filters, select a series/season/episode, inspect sources, return to the original cube. | Source identity, explicit play, resume/progress and actual availability must be verified; specimen state is not playback. |
| Marketplace | Filter products, inspect a selected version, review install prerequisites and return to the results. | Listing is not entitlement, installation or authorized purchase; real effects require the product adapter. |
| BINS | Select an authorized file version, inspect it, return, then exercise permission revocation. | Metadata visibility is not byte access; denied preview/download/export must disclose no private bytes. |
| Document view | Select a document/revision, edit a scoped setting, save, close, reopen and compare rendered output. | Save, export and publish remain different effects; citations and legal rules remain domain-owned. |
| Work view | Filter an existing Work queue, inspect a specific attempt and follow its returned evidence. | Run completion is not Work completion; queue, ACK, execution and accepted return remain distinct. |

A cell needs exact component source/hash, consumer source, installed build where applicable, environment, task/state coverage, expected and observed behaviour, raw evidence, and the actual reviewer identity. Reuse the existing status vocabulary. Missing or stale evidence stays explicit; a source test must not fill an installed-runtime cell.

## Bugzilla reconciliation and quorum

This list is not a ticket import. First find the existing parent defect and affected-consumer records. Attach independently reproduced findings to the existing semantic owner; create a child only when a materially distinct consumer repair needs it. Preserve duplicate source occurrences without duplicating the defect or deleting contrary evidence.

Any proposed update needs the actual Bugzilla product/component/bug identity, current state, reproduction environment, exact source/build, expected versus observed behaviour, evidence references and consumer applicability. A proposal with no reproduction remains a reuse opportunity, not a confirmed defect. Use the existing integration and its idempotency/readback rules; no alternate database, bulk closure or invented callback.

The proposed sequence is: independent candidate sets -> semantic reconciliation -> contract checks -> bounded A/B tasks -> actual independent opposing reviews -> existing accepted quorum rule -> authorized canonical updates -> provider readback -> existing return/apply/readback chain. Do not invent a voting threshold or count aliases of one worker as independent reviewers. A vote cannot turn missing execution evidence into a pass or waive an authorization failure. Disagreements remain unresolved with their supporting evidence.

No Bugzilla updates, human A/B results or quorum are claimed by this document. The current verified Bugzilla route and issue bindings must be recovered before mutation. A historical local contract or a GitHub comment is not a successful Bugzilla transaction.

## Remaining live product work

Episode metadata, episode-bound source selection, resume and progress tests may advance independently of visual specimen approval through the existing Movie Night path. This reuse list does not delay or close that defect. The current cog/full catalogue, authorized BINS binding and real chat detach/reopen requirements also remain product/runtime obligations until verified.

## Candidate-set validation only

The companion JSON is a comparison artifact, not a runtime settings or product registry. It contains exactly 100 unique candidate references in ten editorial groups, with a shared requirement, at least two candidate consumers, reference leads and a verification probe for every item. All experiment results are `NOT_RUN`; all canonical Bugzilla and Work IDs are null. Structural validation of this document grants no adoption, installation or execution credit.
