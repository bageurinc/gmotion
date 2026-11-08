# Interface review — 8 November 2026

## Direction

See DESIGN.md. The UI retains the existing emerald identity, with low-chroma
green neutrals around the video canvas. Removed decorative glows, gradient text,
architecture badges, marketing promises, and repeated starter cards. Forms,
project rows, scene editing, and payment actions carry the hierarchy.

## Changes

- Home: brief form, accessible preset/ratio selections, collapsed model settings,
  actionable project loading/error/empty states, keyboard-operable starter rows.
- Login: plain account explanation and existing Google authentication destination.
- Draft: clearer workflow, action wording, neutral icons, responsive scene headers.
- Studio: responsive canvas, explicit revision labels, inline action failures,
  native export dialog with focus management and Escape dismissal. Closed progress
  can be reopened from the export button. Preview starts paused.
- Credits: readable package rows and accurate variable-cost explanation; pending
  checkout blocks accidental duplicate purchases. QR image reserves dimensions.
- Admin: unboxed definition-list summary, readable tables, period navigation.
- Shared: Indonesian document language, route titles, font tokens, text contrast,
  visible keyboard focus, 44px controls, reduced-motion handling, recovery pages.

## Observed browser checks

Development-only fixture data and intercepted APIs were used for editor and
payment checks. The temporary fixture route was removed afterward. No real AI
generation, payment, or account creation was triggered.

- Home: empty prompt disables submit; format selection updates pressed state;
  model settings expand and select; failed submit displays inline error.
- Examples: filter changes rows; selecting a row fills and focuses the brief.
  The initial list shows six ideas; its expansion control reveals the rest.
- Projects: load failure shows retry; retry recovers to empty state.
- Draft: add, remove, and undo removal update the scene list.
- Credits: package choice displays a scannable QR image with amount and expiry.
- Editor: storyboard and code controls switch content; export opens a dialog;
  sharing platform switches fields; Escape dismisses the dialog.
- Login: renders the Google sign-in link and Indonesian document language.
- Home, draft, credits, editor: checked at 375, 768, and 1440px, without document
  horizontal overflow. No uncaught JavaScript errors during this run.

## Automated validation

97 existing tests passed across draft flow, social sharing, authentication,
billing, and safe-frame behavior. TypeScript validation passed.
The final production build passed. A browser run against that build verified
login rendering, register redirection, signed-out billing access, visible keyboard
focus, 44px button targets, and home layouts at 320/375/768/1024/1440px. The branded
404 page returned HTTP 404 and its recovery link opened the studio. This run also
recorded no uncaught JavaScript errors.

Measured contrast: secondary #9aa99f on #19221d = 6.64:1; subdued #94a298 on
#28352d = 4.81:1; action #101612 on #6ee7b7 = 12.03:1. Field edge #627369 against
#19221d = 3.24:1 (non-text boundary).

## Limits

Real Google OAuth, paid QRIS, AI generation, render output, and admin billing data
were not exercised in the browser. Editor/payment evidence uses fixtures, not live
service verification. Performance field data and Lighthouse were not measured.

## Immediate draft preparation flow

The home action now stores a tab-local brief and navigates immediately to
`/studio/new?request=<UUID>`. The destination starts the draft request and shows a
responsive skeleton, current workflow step, elapsed time, and expandable original
brief. Successful completion replaces the preparation URL with the saved draft;
Back returns to the studio instead of restarting preparation. No estimated
percentage or fabricated per-scene progress is displayed.

Reload and retry reuse an owner-scoped request ID. The API joins active requests
inside the current server process and reopens completed requests from project
storage. Conflicting input is rejected. This follows the existing single-process,
local-project-storage deployment model; it is not a distributed job queue.

Browser verification with a local QA account and intercepted model responses:
navigation before response completion, skeleton at 320/375/768/1440px without
horizontal overflow, expandable brief, reload with the same request ID, automatic
draft opening, Back behavior, inline error, retry, edit with restored prompt, and
blocked browser storage. No uncaught JavaScript errors were observed.

83 tests passed across draft requests, draft flow, authentication, and billing.
The eight request tests cover concurrent deduplication, completed replay,
conflicting input, retry after failure, owner isolation, spent-credit replay, and
invalid request IDs. TypeScript validation passed.
The production build also passed from an isolated copy of the final source. This
kept its build output separate from the actively running development server.
