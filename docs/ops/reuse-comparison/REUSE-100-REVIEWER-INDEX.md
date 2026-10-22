# Reviewer index, Movie Night lane

Candidate references only, not Bugs, Work IDs or pass states.


## 1. Window geometry and universal utilities [R1]

1. **Available-width layout.** Use the content region left after the rail and contextual dock, without inherited narrow-page caps. Examples: Movie Night, Marketplace, BINS.

2. **Readable text inside wide layouts.** Separate paragraph reading measure from the width available to cards, tables, timelines and inspectors. Examples: sam_law, Articles, WordPress.

3. **One scroll owner per region.** Declare whether the document, canvas or list owns scrolling; do not nest accidental scroll traps. Examples: Office, BINS, Movie Night.

4. **Permanent lower-left utilities.** Reuse the existing BINS, @ibal and Settings utility zone, separate from window-management controls. Examples: All desktop plugins, standalone apps.

5. **Adaptive dock sizing.** Respect minimum content and chat sizes; use the accepted narrow-screen presentation when both cannot fit. Examples: Movie Night, Inbox, sam_law.

6. **Native versus virtual frame adapter.** Keep one frame rendering contract with host-specific move, resize, minimize and maximize bindings. Examples: Movie Night, Arcade, Inbox.

7. **Geometry recovery.** Restore saved position and size relative to current displays, not obsolete coordinates. Examples: Office, BINS, Repo Reaper.

8. **Fullscreen state preservation.** Enter and exit fullscreen without changing the selected resource, conversation or unsaved work. Examples: Movie Night, Arcade, Presentations.

9. **Focus restoration.** Return focus to the originating item after details, dialogs or context panels close. Examples: Marketplace, BINS, Work views.

10. **Declared rail extensions.** Place product tools in existing rail slots while universal utilities remain owned by the shared frame. Examples: Movie Night, Inbox, WordPress.


## 2. Declaration-driven settings and preferences [R1]

11. **Full catalogue at the caller.** Open the complete settings catalogue at the requesting app or document section, never an app-only substitute. Examples: Movie Night, Marketplace, Office.

12. **Declared control types.** Render boolean, choice, range, order and text controls from the declared type, not the current value. Examples: Theme, Desktop, account preferences.

13. **One default resolver.** Derive default and fallback values from one versioned declaration across UI and persistence. Examples: Movie Night, Inbox, account preferences.

14. **Validation parity.** Apply the same declaration at every trust boundary without maintaining separate allowed-value lists. Examples: Theme import, Movie Night, product manifests.

15. **Scope and inheritance disclosure.** Show user, device, workspace, app or document ownership and whether a value is inherited or overridden. Examples: Office, Desktop, sam_law.

16. **Preview and cancel.** Treat previews as reversible presentation, not silently persisted preferences or privileged effects. Examples: Theme, Movie Night, Publisher.

17. **Save with effect readback.** Distinguish saved bytes from an applied setting and from restart-qualified behaviour. Examples: Movie Night, Office, Inbox.

18. **Scoped reset preview.** Show exactly which declared values reset and which unrelated settings and files remain untouched. Examples: Desktop, Movie Night, WordPress.

19. **Independent import and export policies.** Honour each declared import, export and reset policy independently, with validation before applying data. Examples: Settings, BINS preference transfer, Office.

20. **Unavailable setting explanation.** Show missing declarations, permissions or adapters as specific unavailable states, not enabled decorative controls. Examples: Native device controls, providers, document settings.


## 3. Record identity, selection and action boundaries [R1]

21. **Typed resource identity.** Carry a domain-qualified identity through every projection instead of using labels or list indexes as identity. Examples: Movie Night, BINS, Marketplace.

22. **Parent-child identity.** Retain the parent and child tuple during selection and action, including valid zero-valued children such as specials. Examples: TV seasons and episodes, document sections, Work attempts.

23. **Revision-bound selection.** Bind selection to the relevant record version or source generation rather than silently following a changed head. Examples: BINS, Office, Repo Reaper.

24. **Selection is not execution.** Keep highlight, inspect and activate separate from play, purchase, install, publish or run. Examples: Movie Night, Marketplace, Cadence.

25. **Nested action isolation.** Prevent a favorite, checkbox, menu or remove action inside a card from also activating the card. Examples: Inbox, Marketplace, BINS.

26. **Keyboard card semantics.** Give selectable and activatable cards the appropriate focus, role and keyboard behaviour. Examples: Marketplace, BINS, Movie Night.

27. **Capability-gated primary action.** Derive action availability from the relevant qualified capability and authorization, not metadata presence. Examples: Ward, Marketplace, Movie Night.

28. **Selection-scoped batch action.** State whether an action applies to selected records, loaded results or the whole matched set. Examples: BINS, Inbox, Work queues.

29. **Stable selection after removal.** Reconcile the selected item when it disappears without selecting an unrelated record for an existing action. Examples: Inbox, BINS, Marketplace.

30. **Explicit destination selection.** Display the actual account, device, site or recipient that will receive an action, distinct from the viewing host. Examples: Publisher, Calendar, Movie Night.


## 4. Search, provider facets and query semantics [R1]

31. **Source is not content category.** Keep provider, account or repository separate from genre, file type or plugin category. Examples: Movie Night, BINS, Marketplace.

32. **Multi-account source scope.** Distinguish two accounts at one provider and keep each query inside its authorized source scope. Examples: Inbox, BINS, Calendar.

33. **Composable predicates.** Reuse declared AND, OR, exclusion, date and range semantics rather than per-view filter code. Examples: Movie Night, Search, Work queues.

34. **Unknown filter preservation.** Preserve unsupported or disconnected filter values as explicit unresolved conditions instead of broadening to All. Examples: Movie Night, BINS, Marketplace.

35. **Reversible filter chips.** Show active constraints and remove one without clearing unrelated predicates or source scope. Examples: Search, Movie Night, Inbox.

36. **Explicit search coverage.** Label whether the query covers loaded records, a local index or a provider-wide search. Examples: Search, Movie Night, BINS.

37. **Saved queries rather than copied results.** Store filter definitions and sorting as live views while keeping manually curated membership a separate domain concept. Examples: Movie Night, BINS, Work views.

38. **Query reset with declared scope.** Reset filters separately from source selection, saved-view deletion or account disconnect. Examples: Search, BINS, Marketplace.

39. **Identity-stable sorting.** Apply stable tie-breaking and preserve the selected identity when sort order changes. Examples: Movie Night, BINS, Benchmark.

40. **Query share and clone boundaries.** Copy or share the query definition with provenance, never credentials or implied access to its results. Examples: Movie Night, Work views, Search.


## 5. Collections, navigation and efficient repeated content [R2]

41. **Identity-preserving view switch.** Switch wall, list, carousel or table presentation without replacing query, selection or resource identity. Examples: Movie Night, Marketplace, BINS.

42. **Centred active-item navigation.** Reuse centred selection with neighbouring items and explicit open behaviour rather than a separate engine per catalogue. Examples: Movie Night, Arcade, template browser.

43. **Directional gesture ownership.** Distinguish horizontal collection gestures from vertical page scrolling and zoom gestures. Examples: Movie Night, BINS shelves, Marketplace.

44. **Bounded rendering.** Virtualize large collections while retaining logical focus and screen-reader position information. Examples: Movie Night, Marketplace, BINS.

45. **Query-keyed cache reuse.** Share equivalent result requests only within the same authorization scope, query and source generation. Examples: Search, Movie Night, BINS.

46. **Cursor-aware continuation.** Follow provider continuation tokens rather than deriving the next page from visible item counts. Examples: Movie Night, Inbox, BINS.

47. **Honest ends and refresh.** Distinguish finite results, locally wrapped navigation, loading more and genuinely exhausted sources. Examples: Movie Night, Marketplace, Search.

48. **Editable vertical row layout.** Unlock row order with drag and keyboard alternatives, plus reversible save and cancel. Examples: Movie Night, BINS, Work dashboards.

49. **Per-row filter editing.** Bind the shared filter editor to one row and distinguish saved row rules from temporary page filters. Examples: Movie Night, BINS saved searches, Work dashboards.

50. **Return-navigation restoration.** Restore the originating query, item and scroll anchor after detail or secondary navigation. Examples: Movie Night, Marketplace, BINS.


## 6. Contextual chat and assistant interaction [R2]

51. **App-scoped right dock.** Bind the existing chat outside the content region to the calling window, user and current selection. Examples: Movie Night, Inbox, sam_law.

52. **Visible context envelope.** Show which app, selected records and scope the assistant is using, with an explicit clear or switch action. Examples: @ibal, BINS, Work views.

53. **Actual chat detachment.** Move the same conversation into a real host window where supported, not a floating div labelled Undock. Examples: Movie Night, Office, Inbox.

54. **Recover closed detached chat.** Reopen or focus the existing conversation from the permanent @ibal utility after its detached window closes. Examples: Movie Night, Marketplace, sam_law.

55. **Draft continuity across presentation.** Preserve unsent text and attachments across dock, detach, minimize and reopen transitions. Examples: @ibal, Inbox assistant, Office assistant.

56. **Proposal versus authorized action.** Present suggestions and previews separately from user-approved execution. Examples: @ibal, Cadence, Repo Reaper.

57. **Truthful message lifecycle.** Present pending, delivered, failed and acknowledged states from real receipts rather than one optimistic Sent state. Examples: @ibal, AI Mail, Inbox.

58. **Shared attachment picking.** Use the authorized BINS picker and preserve resource references, revisions and permission scope. Examples: @ibal, Inbox, sam_law.

59. **Optional assistant onboarding.** Reuse the declared provider/model setup flow while keeping non-AI browsing and editing usable. Examples: Movie Night, Arcade, Office.

60. **Long response and failure recovery.** Reuse streaming, cancellation, retry and partial-response presentation without replacing the conversation engine. Examples: @ibal, Benchmark, Work views.


## 7. Connections, authorized libraries and import workflows [R2]

61. **Capability-labelled connection setup.** Declare whether a connection supports discovery, import, preview, sync, deep linking or native action. Examples: Movie Night, BINS, Inbox.

62. **Scoped authorization explanation.** Show requested account access, purpose and approved scope through the existing connection flow. Examples: BINS, Calendar, WordPress.

63. **Account and endpoint chooser.** Reuse setup and testing presentation with provider-owned URL, authentication and trust validation. Examples: Ollama setup, Plex connection, remote repositories.

64. **Connection-test readback.** Distinguish configured credentials, reachable service and usable required capability. Examples: Movie Night, BINS, Ward.

65. **Expiry and reconnect.** Reuse expired, revoked, offline and reconnect states while preserving selected files and unfinished work. Examples: Inbox, BINS, Calendar.

66. **Scoped BINS entry.** Open the existing authorized library at the caller's app/work context without moving or duplicating its files. Examples: Movie Night, Office, sam_law.

67. **Reference versus import choice.** Explain link/reference, local copy, metadata import and synchronization as distinct operations. Examples: Movie Night, BINS, WordPress.

68. **Import preview and conflict policy.** Reuse count, mapping, duplicate and conflict review before applying supported imports. Examples: Nuvio snapshots, BINS, contact imports.

69. **Revocation-safe previews.** Make preview, download and export consume the same authorized reader and revoke cached access appropriately. Examples: BINS, sam_law, Office.

70. **Disconnect without unintended deletion.** Separate revoking a connection from deleting imported records, user files or saved preferences. Examples: Movie Night, BINS, Inbox.


## 8. Editing, persistence and reversible operations [R2]

71. **Shared dirty-state contract.** Track committed versus draft values without mistaking delayed server hydration for a user edit. Examples: Office, WordPress, Movie Night layouts.

72. **Local undo and redo.** Reuse undo interaction while each domain owns valid inverse operations and irreversible boundaries. Examples: Office, VectorFORGE, layout editing.

73. **Concurrent-edit conflict.** Preserve revision checks and unsaved drafts when another window saves first. Examples: Settings, Office, filter cubes.

74. **Autosave feedback.** Show draft, saving, saved and failed states tied to the actual revision and save response. Examples: Articles, Resume, WordPress.

75. **Saved-revision preview.** Bind preview to a known revision and disclose when it shows unsaved changes instead. Examples: Office, Publisher, sam_law.

76. **Command separation.** Keep Save, Save as, Export, Share and Publish as distinct commands with distinct destinations and effects. Examples: Office, Publisher, BINS.

77. **Drag-to-commit binding.** Make drag-end produce a real domain change or a clearly reversible local draft, never a no-op callback. Examples: Canvas authoring, presentations, cube layouts.

78. **Deletion-scope confirmation.** Identify whether removal affects a view, item reference, local copy, application or underlying source. Examples: BINS, Marketplace, Office.

79. **Export fidelity report.** Report unsupported fields or blocks before export instead of silently omitting them. Examples: WordPress, Office, Articles.

80. **Recovery after interruption.** Recover a staged draft or failed transaction without replaying an uncertain external effect. Examples: Repo Reaper, document editors, settings.


## 9. Truthful state, provenance and accessibility [R2]

81. **Distinct empty and unavailable states.** Differentiate no matches, no data, not loaded, disconnected and permission-denied results. Examples: Movie Night, BINS, Search.

82. **Visible stale-data age.** Label cached or stale results with source generation and freshness rather than presenting them as current. Examples: Movie Night, Work views, Benchmark.

83. **Cancelled-request isolation.** Ignore late results for a previous query, parent record or permission scope. Examples: Search, TV episodes, document previews.

84. **Honest progress and denominators.** Show indeterminate progress when totals are unknown and exact denominators only when established. Examples: BINS imports, installs, Work runs.

85. **Readable evidence drilldown.** Pair a human-readable status with inspectable source, generation, command and readback references. Examples: Ward, Benchmark, Repo Reaper.

86. **Work-stage fidelity.** Preserve queued, delivered, acknowledged, executing, returned and independently verified states. Examples: Switchboard, Cadence, AI Mail.

87. **Uncertain-outcome recovery.** Distinguish failure from unknown outcome and check existing operation identity before offering retry. Examples: Marketplace, publishing, Work dispatch.

88. **Non-colour status meaning.** Keep text and icons for status independent of product-family hue and user theme. Examples: Ward, Marketplace, all themed views.

89. **Reduced-motion and large-text behaviour.** Reuse declared accessibility preferences without losing navigation, clipping actions or forcing animation. Examples: Movie Night, AuDHD Field Guide, Office.

90. **Accessible error recovery.** Associate errors with their controls and return keyboard focus to the relevant fix without clearing valid input. Examples: Settings, BINS, provider setup.


## 10. Plugin lifecycle, white-label publishing and collaboration [R3]

91. **First-run capability checklist.** Assemble onboarding from real declared prerequisites rather than machine-specific instructions or invented readiness. Examples: Movie Night, Arcade, Inbox.

92. **Install-state separation.** Distinguish listed, entitled, installed, configured, runnable and update-eligible states. Examples: Marketplace, desktop launcher, Settings Applications.

93. **Update and rollback review.** Reuse version, permission-change, compatibility and recovery presentation around existing installers. Examples: Marketplace, Ward, Office plugins.

94. **Removal with retained work.** Separate app removal and future-update eligibility from access to retained work and existing entitled capability. Examples: Marketplace, BINS, standalone plugins.

95. **White-label semantic slots.** Render shared title, description, provenance, actions and related-item slots with target-specific styling. Examples: Articles, Publisher, Marketplace, public sites.

96. **Source-labelled related content.** Share recommendation-section states and presentation while each product owns ranking, eligibility and explanation. Examples: Movie Night, Marketplace, Articles.

97. **Schema-derived template inspector.** Populate required slots, allowed options and missing-binding explanations from the selected template declaration. Examples: Articles, Office, WordPress.

98. **Target preview and publish readback.** Preserve the target identity, revision, path and accepted generation from preview through verified publication. Examples: Publisher, WordPress, xi-io sites.

99. **Participant and invitation states.** Reuse participant picking and pending/accepted/declined/expired states through existing collaboration contracts. Examples: Movie Night, Calendar, RealityPools.

100. **Session readiness and recovery.** Reuse lobby, ready, disconnected, rejoin and leave presentation while each domain owns synchronization and access rules. Examples: Movie Night watch parties, Arcade, shared Work sessions.
