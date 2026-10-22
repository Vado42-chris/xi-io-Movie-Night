# Title-detail width repair and reusable specimen, 2026-10-22

## Scope and provenance
One bounded Movie Night consumer repair plus a title-detail review specimen under the existing component audit/rebaseline. Not a new programme, registry, shared engine or 65-product implementation. The owner-supplied XI-IO-component-audit-20261022.md contains 65 review entries, not 65 completed products. Source checkpoint: e1b7324be04c27f64b4cc87530c045a74d81d49d.

## Source repairs
The existing page/detail containers, title carousel, expanded information and cube track use their available content width. The carousel no longer inherits the obsolete 600px three-card cap or the 1040px detail cap. Text paragraphs retain readable measures. These are consumer CSS changes, not a new frame or chat layout. Selected-cover centring and keyboard navigation are preserved.

The existing renderRichDetails recommendation row is visible outside collapsed credits. It ranks shared genres within the loaded, filtered selection. It is NOT a global provider recommendation, personalized model output or verified playback list. No-match films show an explicit message; an empty selection clears previous recommendations. Series retain their separate unresolved episode obligation.

## Reusable specimen
verification/specimens/title-detail-specimen.html, .css and .mjs form one responsive state board. It imports the actual web/filter-cubes.mjs CenteredCarousel and existing app styles. The content region is independent of the shared window rail and existing right-side chat. No alternate chat or window is implemented.

The series variant shows season choice, season zero specials, keyboard-selectable episode rows, current episode identity, and loaded/loading/empty/unavailable states. Changing series or season clears the previous episode. The film variant shows recommendation slots with the same unavailable states. Fixtures are explicitly synthetic. All playback buttons are disabled, with no playback callbacks. Controls change only the visible specimen. No accounts, library writes, private records, settings stores or provider requests are used.

## Exact episode failure, still OPEN
web/app.js rejects series in openSources and playSelectedMovie and labels the action Episode playback unavailable. catalogue_browse.py#meta sanitizes series details without returning episode metadata. player/aries_adapter.py#Adapter.post accepts movie-shaped source/play payloads; Resolver.sources always requests stream/movie. Series/season/episode is not bound through source selection, expiry validation, play, resume or progress. Enabling the button alone would send the wrong request.

After specimen review, the repair belongs in the existing metadata and player path, not a new service. Carry series ID, season (including specials) and episode through selection and opaque source binding. Verify wrong-episode rejection, series-switch cancellation, source expiry, explicit source choice, resume identity and retained history. Original Nuvio installation and credentials remain read-only.

## Executed checks
Isolated browser source tests pass at 1920, 1280, 768 and 390px. Track widths are 1844, 1204, 720 and 354px, exactly the available padded width. Selected-card centre error and page-width overflow are zero. Recommendations work without expanding credits and navigate the same title selection. Empty selection clears old recommendations. Season/specials, keyboard selection, identity clearing and loading/empty/error states pass. All requests were intercepted, with zero real network requests and zero write attempts.

42 Python settings/declaration/cubes/selection/title tests and 16 existing player tests pass. JavaScript syntax and diff whitespace checks pass. These are source/browser checks, not independent review, installed native acceptance, real episode playback or global suite qualification.

## Publication boundary
The specimen can be served as static review assets through the existing /studio/assets route. That does not create a service or qualify playback. The production app has not been closed or reopened for this repair, preserving current work and the chat draft. No settings, credentials, private formats or backend files are changed.
