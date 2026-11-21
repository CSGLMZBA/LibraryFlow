# Sprint 2 Acceptance Register

## Status

Sprint 2 is pending implementation and deployed evidence.

| ID | Scope | Required Evidence | Status |
|---|---|---|---|
| S2-AC-001 | Publisher application submission | Valid/invalid/duplicate/withdrawal tests | Passed |
| S2-AC-002 | Administrator approval | UID claims and reader-to-publisher transition evidence | Passed |
| S2-AC-003 | Administrator rejection | Reason, notification, reader role unchanged | Passed |
| S2-AC-004 | Upload authorization | Reader/pending/rejected cannot call upload APIs | Pending |
| S2-AC-005 | Cloud synchronization | Reload, stable IDs, revision/conflict evidence | Passed |
| S2-AC-006 | Supabase storage | Private file, 20 MB, approved visibility | Pending |
| S2-AC-007 | Scheduled cleanup | 24-hour rejection/deletion job and retry evidence | Pending |
| S2-AC-008 | Moderation | Ban, publisher revoke, book delete, audit records | Pending |
| S2-AC-009 | Session lifecycle | Logout, revocation, account grace period | Pending |
| S2-AC-010 | Deployment | Netlify/Render/Firebase/Firestore/Supabase health evidence | Pending |

No item may be marked passed without a dated command or manual scenario.

## Evidence Record Format

For every passed item, record:

- acceptance ID and linked story/contract section;
- date and environment;
- actor role and test account type;
- route or UI path;
- exact command or manual steps;
- expected result and actual result;
- artifact path, screenshot, or deployment URL;
- reviewer and disposition.

An item remains `Pending` when any required field is missing. A failed item
must include the failure, owner, issue reference, and retest date.

## Passed Evidence — S2-T02 Publisher Applications

- Acceptance IDs: `S2-AC-001`, `S2-AC-002`, `S2-AC-003`
- Linked stories: `US-REA-013`, `US-MOD-005`
- Contract: `SPEC-002-CONTRACTS.md` §2
- Date: 2026-11-20
- Environment: Local Windows TypeScript/Node.js execution
- Actor roles: Reader and moderator
- Route/UI path: Service/repository acceptance path; HTTP routes also implemented
  under `/api/v1/publisher-applications` and `/api/v1/moderation`
- Exact command:
  `npx tsx --test docs/testing/s2-publisher-application.test.mjs`
- Expected result:
  Valid submission creates a pending application with revision 1 and a 30-day
  expiration; duplicate, withdrawal, approval, and rejection behavior follows
  the Sprint 2 contract.
- Actual result:
  5 tests passed, 0 failed, 0 skipped.
- Artifact:
  `docs/testing/s2-publisher-application.test.mjs`
- Work log:
  `docs/agent-logs/vulcan-publisher-applications.md`
- Reviewer: Juan Carlos Zúñiga Alfaro
- Disposition: Passed

## Passed Evidence — S2-T03 Firestore Revisions and Mutation Idempotency

- Acceptance ID: `S2-AC-005`
- Linked stories: Stable-ID cloud synchronization and revision/conflict behavior
- Contract: `SPEC-002-CONTRACTS.md` §3 and §4
- Date: 2026-11-21
- Environment: Local
- Actor role: Publisher and moderator
- Route/UI path: `BookService` repository and revision update paths
- Exact command: `npx tsx --test docs/testing/s2-revisions-conflicts.test.mjs`
- Expected result:
  New books start at revision 1; matching revisions increment to 2; stale
  revisions return `RevisionConflictError` with the server revision and value;
  identical mutation IDs return the cached result; moderator deletion marks
  the book deleted and increments revision.
- Actual result:
  5 tests passed, 0 failed.
- Artifact:
  `docs/testing/s2-revisions-conflicts.test.mjs`
- Work log:
  `docs/agent-logs/vulcan-firestore-revisions.md`
- Reviewer: Juan Carlos Zúñiga Alfaro
- Disposition: Passed
