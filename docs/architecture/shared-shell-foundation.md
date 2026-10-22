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
Inbox, calendar, timesheets, resume, sam_law, AuDHD field guide, Switchboard, BINS, repo reaper, cadence, Ward, xi-io benchmark and office tools. Product category/registration is the dot's suite lane. This repo exports consumer evidence and requirements; it does not create another shell framework or suite registry.

## Pending OS settings contract
The owner reports a reviewed 19-file OS patch with full settings, context-driven app selection, shared theme apply/import and persistence/update fixes. It is not installed. Await exact reviewed source and entry contract, then test against Movie Night's actual settings API and host. Until that test, interoperability is UNKNOWN.
