# Sprint 3 - Cutover and Core Reader Features (Reduced)

## Goal

Turn on and verify the cloud features built in Sprint 2, then add only the
smallest set of reader features. Publisher approval stays a mandatory security
boundary.

## Completion Gate

- Sprint 2 carry-over verified live: `ENABLE_CLOUD_CONTENT` and
  `VITE_CONTENT_MODE=cloud` tested in a browser on Netlify/Render/Firestore.
- The 11 TODO tests from `S2-ACCEPTANCE-REGISTER.md` are executed or formally excluded.
- `DELETION_WORKER_SECRET` rotated; the scheduled workflow passes.
- Account-deletion scope approved and recorded.
- Favorites and 1–5 star ratings work for signed-in readers.
- No real secrets committed; no critical or high unresolved security findings.

## Scope

| Area | Stories | Deliverable |
|---|---|---|
| Sprint 2 carry-over | Cutover | Live verification, optional import of browser-only books |
| Favorites | US-REA-008 | Private favorites |
| Ratings | US-REA-016 | 1–5 stars, average, update, delete |

## Deferred (post-Sprint 3 backlog)

Collections, publisher follows, update notifications, pricing and dummy
purchases, proactive ban notices, publisher-initiated delete, backup/restore
drills, and full accessibility audit. They are not part of this release.

## Owners

| Owner | Deliverable |
|---|---|
| Carlos Gabriel Martinez Bazaldua | Live cutover, secret rotation, sign-off |
| Juan Carlos Zuniga Alfaro | Favorites and ratings contracts and repositories |
| Karlo Silvestre de la Cruz Flores | Favorites and ratings UI |
| Cesar Cutberto Hortelano Jimenez | Run TODO tests and S3 acceptance register |

## Evidence

Create `docs/testing/S3-ACCEPTANCE-REGISTER.md` with dated live results. An item
that is documented but never executed does not count as done.

Contract: [SPEC-003-CONTRACTS.md](../specs/SPEC-003-CONTRACTS.md), limited to
favorites and ratings. Tasks: [SPRINT-002-003-TASK-BOARD.md](./SPRINT-002-003-TASK-BOARD.md).
