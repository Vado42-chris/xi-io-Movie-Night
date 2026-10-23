# xi-io movie night: agent entrypoint

Read README.md, docs/CURRENT.md and xiio/managed-project.manifest.json first.
Canonical source: Vado42-chris/xi-io-Movie-Night, branch main. This is the existing Aries app, adopted in place, not a new implementation.

## Owner rules (2026-10-23): read first

The full rules are in the xi-io.net AGENTS.md, under "Owner rules settled 2026-10-22/23". They apply here too:
- **Failures stay visible and recoverable.** Keep the user's work, explain the failure, route it to the owning worker, and return the repair to the same screen. No empty `catch {}`, no defaults that look like real data, and every `fetch` checks `res.ok`.
- **Report each rung of the evidence ladder separately:** source, reviewed, merged, installed, live, verified from outside.
- **HTTP status is not identity,** and stored flags or hashes are not authority.
- **Artifacts go to this repo, an owning bug or BINS, and are read back.** Chat carries only the link.
- **Sable OS desktop is the customer's signed-in workspace,** and the public sites are its entry points.
- **Every work item has a plain-language name next to its ID.**
- **Pushes, merges, installs and live changes need explicit owner approval.**

## Ownership
The app lane owns this repository, its main branch and the Aries Movie Night source. The user's dot owns suite registration and OS settings integration in Studio. Do not mutate Studio/framework checkouts from this lane. The owner reports Movie Night registration saved; its exact provider receipt is pending handoff, not independently verified here.

## Required boundaries
- Original Nuvio installation, account files and credentials are read-only. Never reset, print, commit or replace them.
- Local runtime, imports, favorites/history, account configuration, controller tokens, stream URLs and screenshots stay out of this public repository.
- Preserve the existing WindowFrame and ChatSnapControl. A standalone app's frame IS the native window. No nested desktop simulation in native mode.
- Preserve installed app identity and user preferences until a separately tested migration exists.
- No media starts on launch, poster selection, metadata load, source lookup or settings changes. New playback requires an explicitly selected, title-bound source.
- Never report metadata, a button, a mocked test or a manifest as native execution proof.
- Do not stop playback for routine development. Check status before any service restart. Do not change an unrelated port or process.
- One writer. Back up scoped changes, test them, commit and read back remote main. No force pushes, git clean or resets.

## Framework
Accepted framework source recovered for adoption: Vado42-chris/xi-io.net @ f2976548b09743f0d54c308c44a71be30752152f.
Follow its AGENTS.md, startup hydration standard and the exact skills listed in xiio/framework-lock.json. Read current remote source before adopting newer generations. Local framework staged changes are unrelated and must remain untouched.
Policy: https://github.com/Vado42-chris/xi-io.net/blob/main/docs/framework/agent-cost-local-first-v1.md
Switchboard admission, BINS custody and independent qualified runtime joins remain unverified. Do not manufacture ACKs, compliance scores or parent returns. Preserve typed gaps in project-tracking/open-work-ledger.md.

## Check
python3 server.py --check
python3 catalogue_browse.py --self-test
python3 -m unittest discover -s player -p 'test_*.py'
python3 -m unittest test_settings
node --check web/app.js
Browser checks must intercept real playback writes and use isolated storage. Document mocked, synthetic and live checks separately.
