# Vulcan — Firestore Revisions

Date: 2026-11-21

## Assignment

- Task: `S2-T03`
- Owner: Juan Carlos Zúñiga Alfaro
- Agent: Vulcan
- Sprint: Sprint 2
- Status: Done

## Scope

Implemented the revision, synchronization, and mutation replay deliverables
for `SPEC-002-CONTRACTS.md` §3 and §4:

- Optimistic concurrency checks for book metadata mutations.
- Revision counters initialized to 1 and incremented after successful updates.
- `RevisionConflictError` with resource ID, server revision, and server value.
- HTTP 409 `REVISION_CONFLICT` controller response data.
- Stable mutation IDs with in-memory idempotency caching.
- Moderator soft-deletion that sets book status to `deleted` and increments revision.
- Shared book status and revision contract types.

## Verification

Observed commands and results:

- `npm run build -w @library-flow/shared`: passed.
- `npm run build -w @library-flow/backend`: passed.
- `npm run build`: passed across shared, backend, and frontend workspaces.
- `npx tsx --test docs/testing/s2-revisions-conflicts.test.mjs`: passed,
  with 7 tests passed and 0 failed.

## Test Evidence

- TC-S2-REV-01: Verified newly created books have revision 1 and status
  `pending`.
- TC-S2-REV-02: Verified a matching revision update increments revision to 2.
- TC-S2-REV-03: Verified stale revision updates throw `RevisionConflictError`
  with server revision 2 and the server book value.
- TC-S2-REV-04: Verified repeated identical mutation IDs return the cached
  book result without re-executing the update.
- TC-S2-REV-05: Verified moderator deletion sets status `deleted` and
  increments the revision.
- TC-S2-REV-06: Verified sequential updates increment revision monotonically from 1 to 3.
- TC-S2-REV-07: Verified updates with future revisions reject with RevisionConflictError.

## Changed Deliverables

- `packages/shared/src/types/book.ts`
- `apps/backend/src/services/book-service.ts`
- `apps/backend/src/controllers/book-controller.ts`
- `apps/backend/src/routes/moderation-routes.ts`
- `docs/testing/s2-revisions-conflicts.test.mjs`
- `docs/testing/S2-ACCEPTANCE-REGISTER.md`
- `docs/agent-logs/vulcan-firestore-revisions.md`
