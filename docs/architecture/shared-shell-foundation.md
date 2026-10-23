# Shared shell foundation: Movie Night reference consumer

Owner decision, 2026-10-22: the same windows, controls, preferences and app behavior carry from virtual Studio to standalone apps and eventually the native desktop. This is an OS foundation, not a decorative theme.

## Boundaries
1. Studio owns reusable WindowFrame, ChatSnapControl, theme tokens and OS settings contracts. Movie Night owns media browsing, library and playback. Keep those responsibilities separate.
2. Presentation composes app content and context. A host adapter maps drag, resize, minimize, maximize, fullscreen and close onto either virtual workspace behavior or verified native operations. Never simulate success when a host capability is absent.
3. Domain services own data and side effects. Preferences have scopes, revision/readback, preview/cancel and visible errors. OS settings are a shared entry point, not a duplicate copy of every app's storage.
4. Native integrations own device access and permission enforcement. The shell must show available, unavailable or unverified capabilities. Browser UI alone proves no display, audio, filesystem, device or process effect.
5. App identity, saved state, keyboard accessibility and navigation survive presentation changes. Native identifiers require migrations, not casual renames.
6. Interactions must remain human-usable without AI. Concierge is optional. Revoke/disable paths must be explicit.

## Acceptance for reuse
Use the same frame source with documented host adaptations. Exercise real native drag/resize/minimize/maximize/fullscreen/close; preserve virtual workspace behavior; test settings persistence and conflict recovery; verify keyboard/focus, narrow layouts, opaque fallback, process ownership and zero effects from unsupported actions.

## Next consumers, not implementation claims
Owner-directed adoption order: **Movie Night → Inbox → Resume → Calendar → Timesheets → sam_law**, after the shared foundation is qualified. AuDHD field guide, Switchboard, BINS, repo reaper, cadence, Ward, xi-io benchmark, office tools and the rest of the existing estate remain in the original rebaseline denominator, not excluded by this pilot sequence. Product category/registration is the dot's suite lane. This repo exports consumer evidence and requirements; it does not create another shell framework or suite registry.

## Pending OS settings contract
The owner reports a reviewed 19-file OS patch with full settings, context-driven app selection, shared theme apply/import and persistence/update fixes. It is not installed. Await exact reviewed source and entry contract, then test against Movie Night's actual settings API and host. Until that test, interoperability is UNKNOWN.


## Shared-window integration increment, 2026-10-22

This existing reference consumer is where reusable behavior is qualified, not where a Movie Night-only shell is invented. The next consumers import the accepted shared generation and bind their own capabilities. They must not copy this app's catalogue, provider logic, chat endpoint, private settings, hard-coded Work labels or storage keys.

The existing WindowFrame owns the left utility zone and content/chat allocation. Its ChatDockSlot now remains a stable element in frame mode, and the reusable PersistentChatPortal in that same module keeps one React chat instance while presentation changes. It changes no chat engine, transport, identity, authorization, result contract or draft store. Existing pending rail/portal work was retained and completed at the shared-component seam rather than replaced.

Allocated content width determines side-by-side versus single-pane chat. Closing chat restores the same mounted content, not a new page. With container-query rules unavailable the conservative layout is one usable pane at a time. Utility styling lives with the existing shared frame stylesheet, not in a copied Movie Night override.

Required host bindings remain explicit: BINS to an authorized library, Settings to the full catalogue focused at the current application, and contextual chat to the actual conversation/capabilities. The current standalone adapter still refuses managed Studio services. The BINS control remains unavailable; local Movie Night settings are NOT the full catalogue. These are unresolved consumer bindings, not permissions to fabricate callbacks.

Browser qualification exercises source components, not native installation: actual measured allocations of 320, 390, 480, 768, 1280 and 1920 CSS pixels; a narrow frame within a wide browser; same DOM/draft/caret/focus; close and restore; pending reply while hidden; short-height reachability; and container rules removed from the delivered stylesheet. Provider replies and native calls are fixtures. This does not prove physical mouse/touch, native separate-window undocking, persistent multi-window draft-store adoption, fullscreen safety, glass contrast, application installation, Loki delivery or suite acceptance.

The successor gate for Inbox is accepted shared source plus Movie Night's installed consumer acceptance, not merely this browser result. Resume, Calendar, Timesheets and sam_law require their own domain action/readback tests. Manual controls and chat-driven actions must invoke the same product capabilities and authorization path; neither channel establishes successful effects without its authoritative readback.


## Consumer handoff and reuse guard, 2026-10-22

Continue parent `settings-sdk-publisher-audit-2026-09-26`, framework #1347 and Movie Night #3 / PR #8. Source changes in this lane belong to the Movie Night integration, not a second BINS engine. Upstream adoption still requires the existing shared owner and review. A declared lane is not an admitted WorkerAssignment.

### What the next consumer can reuse

- Consume the pinned shared frame/dock via the existing vendor provenance, including scoped patches, rather than copying Movie Night. Keep BINS, @ibal and Settings once in the existing bottom-left utility zone. Manual operation and chat use the same app-owned capabilities.
- Bind app/surface/conversation/resource context through the existing host-capability contract. UI context and a read-only routing ceiling are not authenticated resource access. Do not copy Movie Night storage keys or its `personal:movie-night` display/target identifiers as another app's Work identity.
- Keep navigation separate from file operations: open the existing BINS surface without importing, moving, saving or playing anything. Leave selection, player state and the one chat instance mounted. Revoke content access server-side without reporting the library as empty.
- Present missing integration, offline transport, authentication required and actual permission refusal distinctly. An unavailable BINS fixture can pass a safety check, never the library journey.
- Carry each production fix back to its shared source owner; successor products consume the accepted generation and rerun their own action/readback journey. Movie Night is a reference consumer, not a permanently forked SDK.

### Executable guard in the existing runner

`verification/verify-window-template.cjs BUILD OUTPUT --check-served-assets` now checks the four shared component hashes against the existing provenance, the selected build's index/JS/CSS against the actual Aries HTTP responses, and the real refusal adapter against account/capability/entity calls. Optional `--without-container-rules` removes the delivered CSS rules for the fallback test. Resolve Playwright normally or set `MOVIE_NIGHT_PLAYWRIGHT`; optionally set `MOVIE_NIGHT_CHROME` to the installed test browser. No developer-specific module location is embedded in the runner. Output must be outside the build.

The measured pass is explicitly `BROWSER_COMPONENT_REGRESSION`. Native calls and a chat reply are simulated. BINS access, full Settings catalogue, native input, Loki hosting and parent return remain separately unexercised. The runner checks raw served bytes BEFORE CSS fallback transformations. A disposable stale-build negative control must fail before opening a browser. HTTP byte equality is not proof that an already-open native window loaded those bytes.

This runner's current BINS fixture is deliberately UNBOUND. When the host owner delivers a qualified binding, replace that fixture expectation with the real integration journey plus separately retained unavailable/refused cases; do not remove the guard or turn a mocked callback into acceptance. Do not add fields solely to make a test green.

### Existing BINS/host dependency, not another implementation

Source observations on this pass: Movie Night served source is `bff9a0d855c869de901e12a20b0caf4a6db84d5c`; its frame donor is `94c49141a132ed00cdd72d0457911fc40523794f` with exact local patch hashes in `studio-shell/vendor/provenance.json`. Existing BINS source main was observed at `f550ea89650f69846278a7bbbcffc2bf918f8487`. Node's recovered BINS surface/private route was inspected at `b6fcdf1eaf25db7fd97f8be5f3e6abced6608f18`, not Node main `6a254011957efe7d05b1a429f0dac4f5559e1ec2`. These are captured observations, not permanent currentness authority or service-installation proof.

The discovered existing capability entry is `src/lib/capabilityApi.mjs`; it still uses the provider adapter. Existing `src/privatePages.config.js` names the private Bins surface. Neither establishes a qualified Loki endpoint/session for this consumer. The generic component resolver's READ_ONLY path does not prove owner/delegate checks on file bytes. Those checks belong in the BINS/host reader, not Movie Night. Preserve `STUDIO_SERVICE_UNBOUND` and the absent `onOpenBins` until the actual supported binding is delivered. Do not guess `/Bins` on another origin, add Base44 credentials, expose a local custody port, or substitute a folder picker.

BINS #110 owns ResourceRecord/StorageBinding/ResourceVersion custody and identifies Search #570 / HEX #22 as its crossing. BINS #29/#26 retain foundation/provider-neutral runtime work. Framework #351 owns assignment admission, #426 authorized composition/return, #1237 Loki runtime, and #344/#276 sovereign identity/session dependencies. These owners must return a source-pinned supported service/navigation contract, authenticated session binding, resource/delegation enforcement and readable test evidence to the same parent. A GitHub comment is not a worker ACK.

Content-access acceptance remains owner/delegate success and denial for unrelated, cross-tenant, forged-scope and revoked access, checked at actual content retrieval. Browser metadata visibility and catalog membership are not permission. Start with browse/read/return only. Supported writes later require the existing write/readback/reopen contract and uncertain-outcome reconciliation.

### Reference lesson for incoming designs

Keep useful composition ideas from design exports, but do not import their hard-coded palettes, fictitious metrics, generated verification badges, runtime claims or new lifecycle definitions. Entertainment remains UNASSIGNED under the accepted owner contract; an ordering marker is not a hue. The implementation tests existing components and actual effects rather than endorsing a rendered label.


## Owner media-area direction, 2026-10-22

This extends the existing reference-consumer Work `settings-sdk-publisher-audit-2026-09-26` and Movie Night #5/MN-010, not a new library, media platform or assignment. Immediate priority remains a usable title/episode/source/playback journey. BINS service integration and future providers must not delay that repair.

The owner wants the same media area to compose Movie Night, a music player with local-media and qualified streaming-account support, YouTube subscription/channel consumption management, and Discord social bots. Watch parties must extend to listening sessions and other supported media. The existing product owners retain their source and domain semantics. Exact music/YouTube/Discord owner bindings remain to be recovered before implementation; this document neither renames Ensemble nor authorizes duplicate repositories.

Commercial direction: free manual app with concierge chat disabled; $20/month for the @ibal concierge experience, including any number of user-created query cubes. Currency, billing integration, hosted-inference allowance and provider approvals are not invented here. Cube count is not a substitute for compute metering. Disabling or cancelling concierge must leave existing user-created cubes, manual browsing/editing, supported playback and access to owned work available. Provider subscriptions remain separate. No payment, entitlement or account configuration is changed by this source entry.

Manual controls and @ibal must operate the SAME existing capabilities, query-cube declarations, authorizations, persistence and readback. A cube is a user-owned live view or declared ordered selection, not a copy of protected media. Preserve the distinction between a live filter cube and a provider playlist; exporting or updating the latter is a separately confirmed provider operation. A cube may select media by source, type, genre, date, duration and user-owned preferences where supported. Never silently discard an unsupported filter or claim unknown metadata is a negative match.

The common shell retains bottom-left BINS/@ibal/Settings, right-side contextual chat, one selection identity and stable drafts during navigation. The music, video, channel and social consumers reuse those primitives without copying movie-only identifiers, transport controls or provider credentials. BINS remains the authorized resource/cube surface; account linking stays in shared Settings, initially focused at the current app.

Party scope: reuse existing participant/invitation/session authority and messaging. A shared room coordinates a queue and, only where a provider permits, playback state. Every participant needs their own permitted content access. No rebroadcast, stream URL sharing, credential sharing or inferred synchronization capability. Missing-content and unsupported-sync states need useful alternatives rather than false success. Discord integrations use official bot installations with scoped permissions, not user-account automation. Sending invitations/messages requires explicit authority.

Provider qualification recorded 2026-10-22: Spotify explicitly distinguishes monetizable non-streaming playlist management from prohibited commercial streaming examples, prohibits ingesting Spotify Content into AI models, and restricts cross-service content integration and simultaneous-listener webcasting. A separate module name or charging for chat does not automatically make a mixed streaming product compliant. Qualify the exact use case or obtain permission before offering it. Source: https://developer.spotify.com/policy and https://developer.spotify.com/compliance-tips . YouTube authenticated subscription listing is documented at https://developers.google.com/youtube/data/reference/rest/v3/subscriptions/list ; retain official player/API and user-consent obligations under https://developers.google.com/youtube/terms/developer-policies . TIDAL integration and cross-media synchronization are requested, not qualified. Discord bot boundary: https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots .

Acceptance for the concierge differentiator is an actual user request producing a reviewable cube query, explicit save through the existing writer, authoritative readback, visible home row, reopen, manual refinement and deliberate sharing without unintended playback. Source/UI tests do not close the host-session, BINS, provider-policy or real-save gates. No newly available service, licensed stream, social bot or paid entitlement is claimed here.

## Home-to-Watch backfeed boundary, 2026-10-23

Recovered owner: xi-io-node, retained review generation b6fcdf1eaf25db7fd97f8be5f3e6abced6608f18, src/lib/articleTemplates.mjs and the existing PageComposition/PublicPageComposition consumers. EXPERIENCE names Step5Cube, ProgressRow, TicStream and LoopRow; FILES and INTERACT have different existing block sets. Do not relabel Movie Night's DOM as an accepted Article just because it illustrates that experience.

The receiving obligations are: compose verified library history through the existing ProgressRow/data binding; preserve typed sequence and exact episode identity for Watch; bind the existing Bin reference/revision and query rather than snapshot its HTML; preserve the shared drawer/frame and source-authority guards. The inspected renderer has no qualified Movie Night media-binding delivery in this pass. That owner must adopt the missing binding rather than copy a new shell, history store or serializer.

Movie Night provides reusable consumer evidence: one carousel owner with Home rail and centred Bin presentations, existing movie-card projection for resume, exact-source recovery, explicit source play, UI-to-player acknowledgment identity checking and before/after keyboard/container tests. The presentation adapter stays local to its current consumer until the owning Article composition is accepted and exercised by a second product. No source in Node, Studio, Calendar or Reality Pools was modified here.
