# Sprint 2 and Sprint 3 Implementation Task Board

This is the execution board for the contracts in
[SPEC-002-CONTRACTS.md](../specs/SPEC-002-CONTRACTS.md) and
[SPEC-003-CONTRACTS.md](../specs/SPEC-003-CONTRACTS.md). Each row is a
bounded task that can be copied into Microsoft Planner.

## Planner fields

Every Planner task must contain:

- Task ID from this document.
- Assigned owner.
- Sprint and contract section.
- Dependency task IDs.
- Acceptance IDs.
- Verification command or manual scenario.
- Status: `Not started`, `In progress`, `Blocked`, `Ready for review`, or
  `Done`.
- Evidence link when marked `Done`.

No task is complete because code exists. It is complete only when its focused
verification has run and its acceptance evidence is recorded.

## Sprint 2 tasks

| ID | Owner | Bounded deliverable | Dependencies | Acceptance | Verification |
|---|---|---|---|---|---|
| S2-T01 | Bryan | Firebase verification, local auth parity, role claims, refresh, revoke, logout guard | Sprint 1 auth | S2-AC-009 | `npm run typecheck`; auth integration suite |
| S2-T02 | Juan | Application DTOs, repository, validation, active-application uniqueness, state transitions | S2-T01 auth contract | S2-AC-001, S2-AC-002, S2-AC-003 | application repository tests |
| S2-T03 | Juan | Firestore revisions, offline mutation IDs, explicit conflict results for books/applications | S2-T02 | S2-AC-005 | conflict/replay integration tests |
| S2-T04 | Dante | Applicant submission and moderator review screens using shared DTOs | S2-T02 | S2-AC-001, S2-AC-002, S2-AC-003 | frontend typecheck; browser scenarios |
| S2-T05 | Karlo | Reader application status, withdrawal, reload, offline and empty states | S2-T02 | S2-AC-001, S2-AC-003 | frontend typecheck; browser scenarios |
| S2-T06 | Bryan | Account deletion grace period, blocked login, token restriction, and restore hooks | S2-T01 | S2-AC-009 | account lifecycle integration tests |
| S2-T07 | Jorge | Private Supabase bucket, upload constraints, signed access, and CORS | S2-T03 | S2-AC-006, S2-AC-010 | storage/API integration tests; health check |
| S2-T08 | Jorge | Persisted deletion worker, claim/retry/idempotency, rejected/deleted book cleanup | S2-T07 | S2-AC-007, S2-AC-008 | deletion worker tests |
| S2-T09 | Jorge | Render/Netlify environment, health, backup, rollback, and monitoring evidence | S2-T07 | S2-AC-010 | deployed health and rollback scenario |
| S2-T10 | Cesar | Public behavior acceptance, security regression, traceability, defect evidence | S2-T01 through S2-T09 | S2-AC-001 through S2-AC-010 | `npm test`; focused acceptance suite |
| S2-T11 | Carlos | Integration branch, contract review, conflict resolution, demo, sign-off | S2-T02, S2-T03, S2-T04, S2-T05, S2-T06, S2-T08, S2-T10 | S2-AC-001 through S2-AC-010 | `npm run typecheck`; `npm run build`; `npm test`; deployed demo |

## Sprint 3 tasks (reduced scope)

| ID | Owner | Bounded deliverable | Dependencies | Acceptance | Verification |
|---|---|---|---|---|---|
| S3-T01 | Carlos | Live cutover: Netlify `VITE_CONTENT_MODE=cloud`, Render `ENABLE_CLOUD_CONTENT=true`, secret rotation, browser upload check | Sprint 2 closed | S3-AC-012 | `npm run deploy:check`; `npm run storage:verify`; dated browser evidence |
| S3-T02 | Juan | Favorites and ratings (1-5, average, update, delete) persistence and routes | None | S3-AC-002, S3-AC-004 | backend tests |
| S3-T03 | Karlo | Favorites and ratings UI | S3-T02 | S3-AC-002, S3-AC-004 | frontend typecheck; browser scenario |
| S3-T04 | Cesar | Run the 11 Sprint 2 TODO tests and fill the S3 register | S3-T01 | S3-AC-012 | `npm test` |

Deferred to the backlog: collections, follows, pricing and purchases, favorite
update notifications, account-deletion UI, backup/restore, accessibility audit.

## Shared completion rules

1. A dependency must be marked `Done` before dependent work enters
   implementation, unless the owner explicitly records a contract-only
   handoff and the dependent task remains `Blocked` until the dependency is
   complete.
2. Shared types and route names are changed only by the persistence owner,
   with Carlos approving the change before UI consumers update.
3. A failed verification returns the task to `In progress` and requires a
   defect entry with owner, reproduction, and retest evidence.
4. A production credential or secret must never be placed in a Planner task,
   repository file, browser bundle, or acceptance artifact.
5. Sprint 3 cannot close while any Sprint 2 acceptance row is pending or while
   a critical/high security finding is unresolved.
