# Sprint 3 - Cutover and Core Reader Features (Reduced)

## Goal

Verify the Sprint 2 cloud cutover and deliver private favorites and simple
ratings, with bounded work for every team member. Publisher approval stays a
mandatory security boundary.

## Completion Gate

- Sprint 2 carry-over verified live: `ENABLE_CLOUD_CONTENT` and
  `VITE_CONTENT_MODE=cloud` tested in a browser on Netlify/Render/Firestore.
- Reconcile the 11 previously reported TODO tests: implement and run in-scope
  cases, or record each deferred case and Carlos's approval. A skipped or TODO
  test is not a pass.
- `DELETION_WORKER_SECRET` rotated; the scheduled workflow passes.
- Carlos records a decision on account-deletion scope and retention; implementing
  permanent account deletion remains deferred.
- Favorites and 1–5 star ratings work for signed-in readers.
- Authorization and isolation checks pass; local and deployed behavior are
  verified and the acceptance register contains dated evidence.
- No real secrets committed; no critical or high unresolved security findings.
- Carlos reviews the evidence and signs off the release.

## Scope

| Area | Stories | Deliverable |
|---|---|---|
| Sprint 2 carry-over | Cutover | Live verification, worker operation, test reconciliation, deletion-scope decision |
| Favorites | US-REA-008 | Private favorites |
| Ratings | US-REA-016 | 1–5 stars, average, update, delete |
| Release quality | Cross-cutting | Authorization tests, UI states, acceptance evidence and release sign-off |

Ratings require an authenticated reader, not a purchase, for this reduced
sprint. Purchase-gated ratings and favorite update notifications are deferred.
Existing browser-only books are not automatically migrated; migration is not
required for this sprint.

## Deferred (post-Sprint 3 backlog)

Collections, publisher follows, update notifications, pricing and dummy
purchases, proactive ban notices, publisher-initiated delete, backup/restore
drills, permanent account deletion, browser-only book migration, and a full
accessibility audit. They are not part of this release.

## Owners

| Owner | Deliverable |
|---|---|
| Carlos Gabriel Martinez Bazaldua | Integration, deletion-scope decision, release demo and sign-off |
| Bryan Alessandro Peralta Gutierrez | Authorization and account-restriction verification for reader actions |
| Juan Carlos Zuniga Alfaro | Favorites and ratings contracts, persistence and routes |
| Karlo Silvestre de la Cruz Flores | Favorites UI |
| Dante Uriel Juarez Tolentino | Ratings UI |
| Cesar Cutberto Hortelano Jimenez | Acceptance scenarios, TODO reconciliation and evidence |
| Jorge Enriquez Rico | Deployment cutover, storage verification and worker operations |

## Evidence

Update [S3-ACCEPTANCE-REGISTER.md](../testing/S3-ACCEPTANCE-REGISTER.md) with
dated results. An item
that is documented but never executed does not count as done.

Contract: [SPEC-003-CONTRACTS.md](../specs/SPEC-003-CONTRACTS.md), limited to
favorites and ratings. Tasks: [SPRINT-002-003-TASK-BOARD.md](./SPRINT-002-003-TASK-BOARD.md).
All team members and agents follow the
[starter instructions](../agent-prompts/Starter.md).
