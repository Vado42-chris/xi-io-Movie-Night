# Movie Night Phone Remote: native QR pairing review slice

Date: 2026-10-22
Parent: existing Movie Night owner PR #8 / issues #1 and #3.
Status: SOURCE CANDIDATE ONLY / NO NATIVE INSTALL / NO PHONE PAIRING / NO NEW LISTENER.
Objective: one small Phone Remote button in existing Tauri frame; on explicit click,
show a real, one-time, authorized QR invitation to control that same Movie Night
session from a phone. Never open another desktop window, browser or player.

## Source delta
- studio-shell/src/PhoneRemote.jsx: native shell titlebar control and contained
  QR/copy-link disclosure, presented only after a ready capability response.
- studio-shell/src/phone-remote-contract.mjs: pure display validation.
- studio-shell/src/main.jsx and studio-shell/src/style.css: existing frame adoption.
- verification/verify-phone-remote-contract.mjs: offline positive and hostile tests.

This is NOT a separate remote app, player, executor, authority plane, login or
storage model. It reuses the existing Movie Night Tauri shell and later the
existing XI-IO user/device/session + Ward/Switchboard/BINS owners.

## Required private app/worker integration — not implemented by this patch
GET /api/phone-remote/capabilities
  returns (only after actual native admission):
  {"schema":"movie-night.phone-remote-capabilities/v1",
   "application_ref":"personal:movie-night",
   "state":"PAIRING_READY","transport":"https",
   "pairing_origin":"https://<approved-exact-host>/"}

POST /api/phone-remote/pairings
  { "operation":"PAIR_MOVIE_NIGHT_PHONE",
    "application_ref":"personal:movie-night" }
  returns only after exact signed-in actor, current native player identity,
  app-target and Ward-approved pairing capability are verified:
  {"schema":"movie-night.phone-remote-pairing/v1",
   "state":"OFFERED","application_ref":"personal:movie-night",
   "method":"single-use-approved-session",
   "url":"https://<approved-exact-host>/remote/pair/<opaque-invitation>",
   "expires_at":"<ISO 8601 within 120 seconds>",
   "qr_png":"data:image/png;base64,<locally generated PNG bytes>"}

The QR encodes a short-lived invitation, NOT a reusable controller credential,
provider token or arbitrary host command. Remote web redemption must separately
authenticate phone user/session and bind exact parent Movie Night session before
issuing restricted player operations. The owner should approve pairing visibly
within the existing app. Private URLs and secrets must not enter source, logs,
analytics, public BINS or issue comments.

No QR is rendered if backend is absent/unqualified, HTTPS/host differs, the
invitation expires, or response shape is malformed. No remote action or playback
is attempted by this source slice.

## Hard security acceptance — required before any feature availability
- Public unauthenticated /cli/v1/* mutation exposure is contained and externally
  verified. This path MUST NOT be used to pair a phone.
- No new 0.0.0.0 listener, WAN tunnel, QR redirect service, command shell,
  workspace permission, or cloud route. Approved ingress remains under existing
  XI-IO device/session + Ward authority.
- Exact authenticated caller principal, device pairing approval, current
  app/player session, single-use nonce, expiry, replay denial and revocation.
- Only app-scoped browse, read status, play a user-selected title/episode,
  pause/resume, seek, volume, fullscreen and disconnect capabilities. Negative
  attempts at HEX, filesystem, mail, shell, BINS and another user's player deny.
- Transport must be HTTPS and the actual delegated phone session must be
  constrained and revocable. QR response can never by itself authorize effects.
- Disconnection/expiry retains active playback and original library/cube state.
- Cold app reopen, phone resume, multiple phones, stale invitation, concurrent
  approval and lost network are covered by native + actual-phone verification.

## Source check
  node --test verification/verify-phone-remote-contract.mjs
  npm --prefix studio-shell run build

These are eligible in an isolated, non-installed review checkout. No test run
is claimed by this document. A built JSX file or a QR image is not a complete
remote; native installed UI + secure phone interaction + device-bound readback
remain OPEN.

Return to existing owner PR #8 as a review branch with no merge, deploy,
tunnel mutation or owner-live-environment action claimed.
