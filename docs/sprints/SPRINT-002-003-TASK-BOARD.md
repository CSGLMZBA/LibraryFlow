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

Tasks are `Not started` unless progress is explicitly recorded below; existing
code or these descriptions are not evidence of completion. Owners may work in
parallel on independent tasks.
Agent identity, status, evidence, and final commit are recorded in the task and
the owner's agent log; see the [starter instructions](../agent-prompts/Starter.md).

| ID | Owner | Bounded deliverable | Dependencies | Acceptance | Functional verification |
|---|---|---|---|---|---|
| S3-T01 | Carlos | Integrate the release, record deletion-scope/retention decision, run final demo and sign off | S3-T03, S3-T04, S3-T05, S3-T06, S3-T07 | S3-AC-015 | Review evidence; `npm run typecheck`, `npm run build`, `npm test`; dated deployed demo |
| S3-T02 | Juan | Define shared favorites/ratings contract and implement private repositories, routes and rating summaries; no purchase gate | None | S3-AC-002, S3-AC-004 | Focused backend tests for privacy, idempotency, invalid input, updates/deletes and concurrent summaries |
| S3-T03 | Karlo | Favorites controls and private list, including loading, empty, signed-out and error/retry states | S3-T02 contract; integration depends on S3-T02 | S3-AC-002 | Focused frontend tests and browser add/remove/list/reload scenario |
| S3-T04 | Cesar | Reconcile the 11 previously reported Sprint 2 TODOs individually; run in-scope tests and record approved deferrals; execute cross-role acceptance and record evidence | S3-T02, S3-T03, S3-T05, S3-T06, S3-T07 | S3-AC-012, S3-AC-016 | `npm test`; dated local and live browser results; per-TODO dispositions |
| S3-T05 | Bryan | Verify reader-action identity, authorization, privacy and account-restriction handling; fix gaps in the assigned boundary and coordinate with Juan | S3-T02 contract; final feature checks depend on S3-T02 | S3-AC-013 | Focused tests for anonymous, reader, other-user and restricted-account cases; record any unavailable enforcement as a blocker |
| S3-T06 | Dante | Ratings controls and summary, including loading, signed-out, invalid input and error/retry states | S3-T02 contract; integration depends on S3-T02 | S3-AC-004 | Focused frontend tests and browser rate/update/delete/reload scenario |
| S3-T07 | Jorge | Verify Render/Netlify configuration and live storage; coordinate worker-secret rotation and scheduled workflow verification | Provider access and owner authorization | S3-AC-012, S3-AC-014 | `npm run deploy:check`; `npm run storage:verify`; dated signed upload/download and workflow evidence |

S3-T03, S3-T05 and S3-T06 may start with a reviewed contract-only handoff,
but remain blocked from integration and `Done` until S3-T02 is complete.
Karlo and Dante coordinate before editing shared UI files; Bryan and Juan
coordinate changes to shared authorization or route files. Provider access or
live credentials may require Carlos's help.

### S3-T07 progress

- **Done: worker-secret rotation and manual verification** (2026-11-25):
  Carlos updated the secret in Render and GitHub while the workflow was
  disabled, then authorized re-enabling it. The
  [manual verification run](https://github.com/CSGLMZBA/LibraryFlow/actions/runs/45736168783)
  succeeded. It claimed no deletion jobs; application expiry reported
  `enabled: false`. No secret value is recorded.
- **Still pending:** verify a scheduled run, the live browser upload/download
  path and the remaining deployment and storage evidence. S3-T07 and
  S3-AC-014 are not yet done.

Deferred to the backlog: collections, follows, pricing and purchases, favorite
update notifications, permanent account deletion, browser-only book migration,
backup/restore drills and a full accessibility audit.

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
5. Sprint 2 acceptance rows remain pending until supported by evidence; Carlos
   must record the disposition of each outstanding row and each TODO without
   marking deferred work passed. Sprint 3 cannot close with an unresolved
   in-scope acceptance item or a critical/high security finding.
6. Only mark a task `Done` when its actual functional checks pass, evidence is
   recorded, and its final agent commit contains the required complete summary.
   If a check cannot run or fails, record the blocker; do not claim success.
