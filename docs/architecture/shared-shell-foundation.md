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
