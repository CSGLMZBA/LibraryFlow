# Sprint 2 Acceptance-Criteria Register

This register is the QA verification source of truth for Sprint 2 (`S2-T10`). Each acceptance item maps to detailed test cases (`TC-S2-*`) derived from the Sprint 2 user stories (`US-REA-013`, `US-REA-017`, `US-REA-019`, `US-REA-020`, `US-MOD-004`, `US-MOD-005`, `US-MOD-007`, `US-MOD-008`, `US-MOD-011`), `SPEC-002-CONTRACTS.md`, and `docs/user_stories/FIELD_RULES.md`. No item may be marked `Passed` until implementation exists and actual verification evidence is recorded below.


## 1. Master Acceptance Summary

| ID | Scope / story | Acceptance coverage | Specification | Owner | Evidence required | Status |
|---|---|---|---|---|---|---|
| S2-AC-001 | `US-REA-013` CA-001–CA-007 | Publisher application submission, validation, duplicate prevention, withdrawal, resubmission, expiration | SPEC-002 §2, §2.1, §2.2, §2.3 | Juan, Dante, Karlo | Application API tests, browser scenarios | Passed |
| S2-AC-002 | `US-MOD-005` CA-001 | Administrator approval: atomic role change, custom claims, notification | SPEC-002 §2.2 (approve), §1.3 | Juan, Bryan, Dante | Approval transaction tests, claim verification | Passed |
| S2-AC-003 | `US-MOD-005` CA-002, `US-REA-013` CA-003 | Administrator rejection: reason required, role unchanged, notification | SPEC-002 §2.2 (reject), §7 | Juan, Dante | Rejection tests, notification evidence | Passed |
| S2-AC-004 | `US-REA-013` RN-006, `US-MOD-005` RN-004 | Upload authorization: reader/pending/rejected cannot call upload or book creation APIs | SPEC-002 §4, §1.3 | Bryan, Juan | Authorization guard tests | Pending |
| S2-AC-005 | `US-PUB-001`, `US-PUB-004` | Cloud synchronization: stable IDs, revision numbers, explicit conflict results, offline mutation IDs | SPEC-002 §3 | Juan | Conflict/replay integration tests | Pending |
| S2-AC-006 | `US-PUB-001`, `US-MOD-006` | Supabase storage: private bucket, 20 MB limit, signed access, no credentials in frontend | SPEC-002 §4 | Jorge | Storage/API integration tests, health check | Pending |
| S2-AC-007 | `US-MOD-006`, `US-MOD-008` | Scheduled cleanup: 24h rejection deletion job, claim/retry/idempotency, exponential backoff | SPEC-002 §5 | Jorge | Deletion worker tests | Pending |
| S2-AC-008 | `US-MOD-004`, `US-MOD-007`, `US-MOD-008` | Moderation: temporary/permanent bans, publisher revocation, book deletion, immutable audit records | SPEC-002 §6 | Juan, Bryan, Jorge | Moderation API tests, audit verification | Pending |
| S2-AC-009 | `US-REA-019`, `US-REA-020`, `US-REA-017` | Session lifecycle: Firebase token verification, refresh, revocation, logout guard, 30-day account deletion grace period | SPEC-002 §6 | Bryan | Auth integration suite, account lifecycle tests | Pending |
| S2-AC-010 | Sprint 2 platform | Deployment: Netlify/Render/Firebase/Firestore/Supabase health, CORS, environment variables, backup, rollback | SPEC-002 §8 | Jorge, Carlos | Deployed health and rollback scenario | Pending |
No item may be marked passed without a dated command or manual scenario.

---

## 2. Detailed Traceable Test Cases (`S2-T10`)

### 2.1 Publisher Application Submission (`S2-AC-001`: `US-REA-013`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-001 | `S2-AC-001` / `US-REA-013` CA-001 | Submit a valid publisher application | Authenticated `reader`; no prior pending/approved application | POST `/api/v1/publisher-applications` with valid `publisherName` (≤ 100), `legalRepresentativeName` (≤ 100), `independentPublisher` (boolean), `publisherEmail` (valid email, ≤ 50), optional `website` (https URL, ≤ 200) | 201 response with `PublisherApplication` in `pending` status; `expiresAt = createdAt + 30 days`; `revision: 1`; account remains `reader` | Automated | Not started |
| TC-S2-002 | `S2-AC-001` / `US-REA-013` CA-002 | Reject invalid application fields | Authenticated `reader` | 1) Submit empty `publisherName`; 2) Submit `publisherName` > 100 chars; 3) Submit invalid `publisherEmail`; 4) Submit `publisherEmail` > 50 chars; 5) Submit `website` without `https`; 6) Submit `website` > 200 chars; 7) Submit missing `independentPublisher`; 8) Submit missing `legalRepresentativeName` | 400 `VALIDATION_ERROR` with `field` for each; no application created | Automated | Not started |
| TC-S2-003 | `S2-AC-001` / `US-REA-013` CA-004 | Prevent duplicate active application | Authenticated `reader`; pending application exists | POST `/api/v1/publisher-applications` with valid data | 409 `DUPLICATE_RESOURCE`; existing application status shown | Automated | Not started |
| TC-S2-004 | `S2-AC-001` / `US-REA-013` CA-004 | Prevent application by approved publisher | Authenticated user with `approved` application (now `publisher`) | POST `/api/v1/publisher-applications` with valid data | 409 `DUPLICATE_RESOURCE` or 403 `FORBIDDEN`; no new application created | Automated | Not started |
| TC-S2-005 | `S2-AC-001` / `US-REA-013` CA-005 | Withdraw a pending application | Authenticated `reader`; pending application exists with `revision: 1` | POST `/api/v1/publisher-applications/:id/withdraw` with `{ revision: 1 }` | 200 response; status becomes `withdrawn`; revision incremented; account remains `reader` | Automated | Not started |
| TC-S2-006 | `S2-AC-001` / `US-REA-013` CA-005 | Reject withdrawal of non-pending application | Authenticated `reader`; application in `rejected` status | POST `/api/v1/publisher-applications/:id/withdraw` with `{ revision }` | 409 `INVALID_STATE`; application unchanged | Automated | Not started |
| TC-S2-007 | `S2-AC-001` / `US-REA-013` CA-006 | Resubmit after rejection or withdrawal | Authenticated `reader`; prior application is `rejected` or `withdrawn` | POST `/api/v1/publisher-applications` with new valid data | 201 with new `pending` application; new unique `id`; new `expiresAt` | Automated | Not started |
| TC-S2-008 | `S2-AC-001` / `US-REA-013` CA-007 | Expire an unresolved 30-day pending application | Pending application with `expiresAt` in the past | Scheduled worker runs expiration check | Application status becomes `expired`; applicant receives `publisher_application_expired` notification; account remains `reader` | Automated | Not started |
| TC-S2-009 | `S2-AC-001` / `US-REA-013` RN-001 | Public registration never grants publisher | Unauthenticated user | POST `/api/v1/auth/register` with `requestedRole: 'publisher'` | Registration creates only `reader` or rejects; never sets `publisher` role or upload permission | Automated | Not started |
| TC-S2-010 | `S2-AC-001` / `US-REA-013` RN-002 | Only authenticated readers may submit | Unauthenticated request | POST `/api/v1/publisher-applications` without Bearer token | 401 `AUTH_REQUIRED` | Automated | Not started |

### 2.2 Administrator Approval (`S2-AC-002`: `US-MOD-005`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-011 | `S2-AC-002` / `US-MOD-005` CA-001 | Approve a pending application atomically | Authenticated `moderator`; pending application with `revision: 1` | POST `/api/v1/moderation/publisher-applications/:id/approve` with `{ revision: 1 }` | 200 response; application status `approved`; account role atomically changes to `publisher` via custom claims; revision incremented; audit record created; `publisher_application_approved` notification sent | Automated | Not started |
| TC-S2-012 | `S2-AC-002` / `US-MOD-005` RN-001 | Non-moderator cannot approve | Authenticated `reader` or `publisher` | POST `/api/v1/moderation/publisher-applications/:id/approve` | 403 `FORBIDDEN`; application unchanged | Automated | Not started |
| TC-S2-013 | `S2-AC-002` / `US-MOD-005` RN-002 | Approval transaction is atomic | Moderator; pending application | Approve with correct revision; simulate partial failure | Either all writes succeed (application, role, audit, notification) or none; no partial role grant | Automated | Not started |
| TC-S2-014 | `S2-AC-002` / SPEC-002 §3 | Approval with stale revision is rejected | Moderator; pending application at `revision: 2` | POST approve with `{ revision: 1 }` | 409 `REVISION_CONFLICT` with `serverRevision: 2` and `serverValue`; application unchanged | Automated | Not started |

### 2.3 Administrator Rejection (`S2-AC-003`: `US-MOD-005`, `US-REA-013`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-015 | `S2-AC-003` / `US-MOD-005` CA-002 | Reject a pending application with reason | Authenticated `moderator`; pending application with `revision: 1` | POST `/api/v1/moderation/publisher-applications/:id/reject` with `{ revision: 1, reason: "Insufficient identity verification" }` | 200 response; status `rejected`; `decisionReason` persisted; `reviewerUid` set; revision incremented; account remains `reader`; `publisher_application_rejected` notification sent with reason | Automated | Not started |
| TC-S2-016 | `S2-AC-003` / SPEC-002 §2.1 | Reject without reason or with invalid reason | Authenticated `moderator`; pending application | 1) POST reject with empty `reason`; 2) POST reject with `reason` > 500 chars | 400 `VALIDATION_ERROR` with `field: "reason"`; application unchanged | Automated | Not started |
| TC-S2-017 | `S2-AC-003` / SPEC-002 §2.2 | Reject non-pending application | Moderator; application in `approved` status | POST reject with valid reason | 409 `INVALID_STATE`; application unchanged | Automated | Not started |
| TC-S2-018 | `S2-AC-003` / `US-MOD-005` RN-003 | Rejection never grants publisher privileges | Reader with rejected application | Verify account role and attempt book creation | Account remains `reader`; `POST /api/v1/books` returns 403 `FORBIDDEN` | Automated | Not started |

### 2.4 Upload Authorization (`S2-AC-004`: `US-REA-013` RN-006, `US-MOD-005` RN-004)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-019 | `S2-AC-004` / `US-REA-013` RN-006 | Reader cannot create books or upload | Authenticated `reader` without application | POST `/api/v1/books` with valid book data | 403 `FORBIDDEN` | Automated | Not started |
| TC-S2-020 | `S2-AC-004` / `US-MOD-005` RN-004 | Pending applicant cannot create books or upload | Authenticated `reader` with `pending` application | POST `/api/v1/books` with valid book data | 403 `FORBIDDEN` | Automated | Not started |
| TC-S2-021 | `S2-AC-004` / `US-REA-013` RN-006 | Rejected applicant cannot create books or upload | Authenticated `reader` with `rejected` application | POST `/api/v1/books` with valid book data | 403 `FORBIDDEN` | Automated | Not started |
| TC-S2-022 | `S2-AC-004` / `US-MOD-007` RN-002 | Revoked publisher cannot create books or upload | Account whose publisher status was revoked | POST `/api/v1/books` with valid book data | 403 `FORBIDDEN`; role is `reader` | Automated | Not started |

### 2.5 Cloud Synchronization (`S2-AC-005`: SPEC-002 §3)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-023 | `S2-AC-005` / SPEC-002 §3 | Revision-controlled mutations | Application or book record at `revision: 1` | 1) Update with `revision: 1` → succeeds, `revision: 2`; 2) Update again with `revision: 1` | First update succeeds; second returns 409 `REVISION_CONFLICT` with `serverRevision: 2` and `serverValue` | Automated | Not started |
| TC-S2-024 | `S2-AC-005` / SPEC-002 §3 | Conflict response preserves server value | Two concurrent modifications to same record | Simulate two mutations with same `revision` | The winning mutation persists; the loser receives `REVISION_CONFLICT` including the full `serverValue`; no silent overwrite | Automated | Not started |
| TC-S2-025 | `S2-AC-005` / SPEC-002 §3 | Stable IDs survive reload | Firestore records created with known IDs | Reload application; query same IDs | Records returned with identical `id` values and correct `revision` | Automated | Not started |
| TC-S2-026 | `S2-AC-005` / SPEC-002 §3 | Offline mutation IDs and idempotent replay | Offline IndexedDB queue with mutation IDs | Queue offline mutation; reconnect and replay | Successful replay removes queue item; conflict remains visible to user; no indefinite retry | Automated | Not started |

### 2.6 Supabase Storage (`S2-AC-006`: SPEC-002 §4)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-027 | `S2-AC-006` / SPEC-002 §4 | Private bucket enforces access | `book-files` bucket is private | Attempt direct URL access without signed token | Access denied; no public URL available | Automated | Not started |
| TC-S2-028 | `S2-AC-006` / SPEC-002 §4 | Upload constraint: 20 MB maximum | Authenticated `publisher` | 1) Upload valid PDF ≤ 20 MB → succeeds; 2) Upload PDF > 20 MB → rejected | Valid file stored at `books/{bookId}/{revision}/{sanitizedName}`; oversized file rejected with error | Automated | Not started |
| TC-S2-029 | `S2-AC-006` / SPEC-002 §4 | Signed download URL for authorized readers | Authenticated `reader`; approved book exists | Request download URL from server | Server returns a temporary signed URL that expires within 10 minutes; no service-role key exposed | Automated / Manual | Not started |
| TC-S2-030 | `S2-AC-006` / SPEC-002 §4 | No credentials in frontend bundle | Built frontend application | Inspect Netlify bundle for `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PRIVATE_KEY`, `DELETION_WORKER_SECRET` | Zero matches; no service credentials in client-side code | Automated | Not started |

### 2.7 Scheduled Cleanup (`S2-AC-007`: SPEC-002 §5)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-031 | `S2-AC-007` / SPEC-002 §5 | Rejection creates 24h deletion job | Moderator rejects a book | Check `deletionJobs` collection | `DeletionJob` created with `kind: "rejected-book-file"`, `dueAt = rejectedAt + 24h`, `status: "pending"`, `attempts: 0` | Automated | Not started |
| TC-S2-032 | `S2-AC-007` / SPEC-002 §5 | Worker claims and completes a job | Pending deletion job with `dueAt` in the past | Worker runs | Job transitions: `pending` → `processing` (with `claimedAt`) → `completed` (with `completedAt`); file removed from Supabase bucket | Automated | Not started |
| TC-S2-033 | `S2-AC-007` / SPEC-002 §5 | Failed job retries with exponential backoff | Deletion job that fails during processing | Worker runs; simulate storage failure | `status: "failed"`; `attempts` incremented; `lastError` stores safe message; `nextAttemptAt` set with backoff; job NOT deleted from database | Automated | Not started |
| TC-S2-034 | `S2-AC-007` / SPEC-002 §5 | Completed job is never reprocessed | Completed deletion job exists | Worker runs again | Job is skipped; `completedAt` unchanged; file remains deleted | Automated | Not started |
| TC-S2-035 | `S2-AC-007` / SPEC-002 §5 | Permanent deletion creates immediate cleanup job | Moderator permanently deletes a book | Check `deletionJobs` collection | `DeletionJob` created with `kind: "deleted-book-file"`, `dueAt = now`, `status: "pending"`; book record marked `deleted` | Automated | Not started |

### 2.8 Moderation (`S2-AC-008`: `US-MOD-004`, `US-MOD-007`, `US-MOD-008`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-036 | `S2-AC-008` / `US-MOD-004` CA-001 | Apply a temporary ban | Authenticated `moderator`; target user active | POST ban with `reason`, `startsAt`, `endsAt` | Ban record created with `actorUid`, `targetUid`, `reason`, `startsAt`, `endsAt`; target receives `ban_changed` notification; target blocked from restricted actions | Automated | Not started |
| TC-S2-037 | `S2-AC-008` / `US-MOD-004` CA-002 | Apply a permanent ban | Authenticated `moderator`; target user active | POST ban with `reason`, `startsAt`, `permanent: true` | Ban record created without `endsAt`; target remains restricted until moderator lifts ban | Automated | Not started |
| TC-S2-038 | `S2-AC-008` / `US-MOD-004` CA-003 | Non-moderator cannot ban | Authenticated `reader` or `publisher` | POST ban endpoint | 403 `FORBIDDEN`; no ban created | Automated | Not started |
| TC-S2-039 | `S2-AC-008` / `US-MOD-004` RN-002 | Banned user cannot comment, upload, or access moderation targets | Active ban on user | 1) POST comment; 2) POST book; 3) Access restricted endpoints | 403 `ACCOUNT_RESTRICTED` for all; content hidden from public | Automated | Not started |
| TC-S2-040 | `S2-AC-008` / `US-MOD-007` CA-001 | Revoke publisher privileges | Authenticated `moderator`; target is `publisher` | POST `/api/v1/moderation/publishers/:uid/revoke` with `{ reason }` | 200 response `{ uid, role: "reader" }`; publisher role removed; existing books handled per moderation policy; `publisher_revoked` notification sent; audit record created | Automated | Not started |
| TC-S2-041 | `S2-AC-008` / `US-MOD-007` RN-003 | Revocation audit record is immutable | Publisher revocation completed | Query audit records | Record contains `actorUid`, `targetUid`, `reason`, `action: "publisher_revoked"`, `timestamp`; record is immutable | Automated | Not started |
| TC-S2-042 | `S2-AC-008` / `US-MOD-008` CA-001 | Delete a book permanently | Authenticated `moderator`; approved book exists | DELETE `/api/v1/moderation/books/:id` | Book record marked `deleted`; removed from public catalog; publisher receives `book_deleted` notification with reason; immediate cleanup job created; audit record stored | Automated | Not started |
| TC-S2-043 | `S2-AC-008` / `US-MOD-008` RN-005–RN-007 | Deleted book removed from storage and search | Deleted book record | Query catalog; attempt direct access | Zero results in search/catalog; bucket file removed by cleanup job; metadata removed | Automated | Not started |

### 2.9 Session Lifecycle (`S2-AC-009`: `US-REA-019`, `US-REA-020`, `US-REA-017`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-044 | `S2-AC-009` / `US-REA-019` CA-001 | Token expiration after inactivity | Authenticated session; 30-minute inactivity period | Wait for expiration (simulated) | Session token expires; subsequent request returns 401 `AUTH_INVALID` | Automated | Not started |
| TC-S2-045 | `S2-AC-009` / `US-REA-019` CA-002 | Token refresh extends session | Authenticated session near expiration | POST `/api/v1/auth/refresh` | New token issued; session extended; old token invalidated | Automated | Not started |
| TC-S2-046 | `S2-AC-009` / `US-REA-019` CA-003, `US-REA-020` CA-001–CA-002 | Logout revokes tokens and clears session | Authenticated session | POST `/api/v1/auth/logout` | Refresh and session tokens revoked; local session cleared; subsequent request with old token returns 401; redirect to login page | Automated | Not started |
| TC-S2-047 | `S2-AC-009` / `US-REA-020` CA-004 | Access after logout is denied | Session invalidated by logout | GET any protected endpoint with old Bearer token | 401 `AUTH_INVALID`; redirect to login; notification of session expiration | Automated | Not started |
| TC-S2-048 | `S2-AC-009` / `US-REA-017` CA-001 | Account deletion request starts grace period | Authenticated user | POST `/api/v1/account/deletion-request` | `deletionRequestedAt` set; `permanentDeletionAt = now + 30 days`; personal public fields removed immediately | Automated | Not started |
| TC-S2-049 | `S2-AC-009` / `US-REA-017` CA-003 | Login blocked during grace period | Account with active deletion request | POST `/api/v1/auth/login` | 403 `ACCOUNT_RESTRICTED`; message indicates pending deletion and grace period | Automated | Not started |
| TC-S2-050 | `S2-AC-009` / `US-REA-017` CA-001 | Cancel deletion during grace period | Account with active deletion request within 30 days | POST `/api/v1/account/deletion-cancel` | Account restored to active; `deletionRequestedAt` cleared; login re-enabled | Automated | Not started |
| TC-S2-051 | `S2-AC-009` / `US-MOD-011` CA-001 | Moderator restores a deleted account | Account pending deletion or deleted | POST `/api/v1/moderation/accounts/:uid/restore` | Account marked active; user receives `account_restored` notification; audit record with moderator ID, user ID, timestamp | Automated | Not started |
| TC-S2-052 | `S2-AC-009` / SPEC-002 §1.2–§1.3 | Every protected handler checks auth chain | Various protected endpoints | 1) No token → 401; 2) Invalid token → 401; 3) Banned account → 403; 4) Deletion-pending → 403; 5) Wrong role → 403 | Each check enforced in order per SPEC-002 §1.3 | Automated | Not started |

### 2.10 Deployment (`S2-AC-010`: SPEC-002 §8)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-S2-053 | `S2-AC-010` / SPEC-002 §8 | Health endpoint is accessible and unauthenticated | Deployed Render backend | GET `/health` without authentication | 200 `HealthResponse`; no authentication required | Manual | Not started |
| TC-S2-054 | `S2-AC-010` / SPEC-002 §8 | CORS allows only configured origins | Deployed backend | 1) Request from `FRONTEND_ORIGIN` → allowed; 2) Request from `https://evil.example.com` → blocked | Only configured `FRONTEND_ORIGIN` values receive CORS headers; `*` is never used in production | Manual | Not started |
| TC-S2-055 | `S2-AC-010` / SPEC-002 §8 | No secrets in source or VITE_* variables | Repository and Netlify build output | Search repository for `FIREBASE_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DELETION_WORKER_SECRET` in source; verify no `VITE_` name contains a service key | Zero matches; all secrets in platform environment only | Automated | Not started |
| TC-S2-056 | `S2-AC-010` / SPEC-002 §8 | Frontend environment uses only public config | Netlify build environment | Verify `VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` are public-only | No service-role keys, private keys, or worker secrets exposed | Manual | Not started |
| TC-S2-057 | `S2-AC-010` / Sprint 2 DoD | Backup and rollback evidence | Deployed platform | 1) Take backup snapshot; 2) Deploy breaking change; 3) Roll back; 4) Verify restored health | Backup captured; rollback completes; health returns 200; no data loss | Manual | Not started |
| TC-S2-058 | `S2-AC-010` / Sprint 2 DoD | Netlify frontend communicates with Render backend | Deployed frontend and backend | Open Netlify URL; login; perform application submission | Frontend API calls reach Render backend through CORS; full round-trip succeeds | Manual | Not started |

---

## 3. Execution Record & Evidence Log

No acceptance item is marked `Passed` until implementation exists and the verification has actually run.

| Date (UTC) | AC / Test IDs | Command or Manual Scenario | Result | Defect / Notes |
|---|---|---|---|---|

---

## 4. Defect Log (`S2-T10`)

| Defect ID | Related AC / TC | Severity | Summary | Assigned Owner | Status | Re-test Evidence |
|---|---|---|---|---|---|---|

---

## 5. Evidence Record Format

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

## S2-T01 incremental verification — 2026-11-21

- Acceptance: S2-AC-009 (partial); US-REA-010, US-REA-019, US-REA-020;
  SPEC-002-CONTRACTS.md sections 1.1–1.3 and 6.
- Environment: Work Linux, Node.js 24.22.3; mocked Firebase client/admin and
  HTTP transport. Actor: reader; wrong-role publisher access is rejected.
- Paths: /api/v1/auth/session, /refresh, /logout (adapter/service calls).
- Command: npm test, with focused cases in s2-auth-lifecycle.test.mjs,
  s2-auth-registration.test.mjs and s1-cross-cutting.test.mjs.
- Expected: restore/renew tokens, verify roles and revoked credentials,
  clear SDK state on logout, deny late restoration, preserve errors on outages,
  and prevent local public publisher registration.
- Actual: focused automated scenarios pass. Live Firebase/browser scenarios,
  inactivity expiry and account lifecycle remain pending.
- Artifacts: docs/testing/s2-auth-lifecycle.test.mjs;
  docs/testing/S2-AUTH-SESSION-HANDOFF.md;
  docs/agent-logs/codex-s2-t01-session-2026-11-21.md.
- Reviewer: team review pending. Disposition: Partial; S2-AC-009 stays Pending.
- Baseline defect: nonexistent approve import in
  s2-publisher-application.test.mjs prevented module loading. Removed the
  unused import and reran the baseline successfully; no application service
  implementation was changed. Owner of this correction: Bryan.

## S2-T01 / S2-T06 contract amendment and behavioral evidence

- Owner authorization: Bryan requested modification of the MD and continuation
  of his Sprint 2 implementation; SPEC-002-CONTRACTS.md section 10 documents
  the resulting clarification for integration review.
- Acceptance/story mapping: S2-AC-009, TC-S2-044–052; US-REA-019/020/017 and
  US-MOD-011; SPEC-002-CONTRACTS.md sections 1, 6 and 10.
- Environment: Work Linux, Node 24.22.3; reader and moderator fixtures;
  controlled clocks, transactional memory test storage and mocked Firebase/HTTP.
- Paths: /api/v1/auth/session, /refresh, /logout;
  /api/v1/account/deletion-request, /deletion-cancel;
  /api/v1/moderation/accounts/:uid/restore.
- Command: npm run typecheck; npm run build; npm test.
- Observed result: typecheck/build passed; Sprint 1 20 passed, Sprint 2 88
  passed, 0 failures. 42 unrelated inherited placeholder assertions remain.
- Expected and actual: 30-minute boundary/replay denial, renewed-token
  replacement, revocation, 30-day job and queued-email creation, restricted
  accounts, cancellation/worker boundary, moderator permission/revision checks
  and public-field redaction behave as covered by the focused suites.
- Artifacts: s2-account-policy.test.mjs, s2-account-routes.test.mjs,
  s2-auth-lifecycle.test.mjs, s2-auth-routes.test.mjs and
  S2-AUTH-SESSION-HANDOFF.md.
- Review disposition: automated service/router checks passed; independent
  reviewer and live Firebase/Firestore/browser evidence pending. S2-AC-009
  remains Pending. Queued email is not proof of delivery; permanent deletion,
  settings UI, cloud rules deployment and delivery worker remain cross-owner
  handoffs rather than fabricated passed scenarios.


### Bryan S2-T01 / S2-T06 moderator-request clarification — 2026-11-22

- Owner: Bryan Alessandro Peralta Gutierrez; agent: Codex.
- Contract: SPEC-002-CONTRACTS.md sections 6 and 10 now distinguish a user
  cancellation request from moderator approval, as clarified by the team.
- Verified deletion-pending login exposes the request action. Submission
  returns 202 pending without clearing restrictions or issuing a session.
  An active moderator lists and explicitly approves a request with the
  current account revision. No self restoration is permitted.
- Automated checks: typecheck and production build passed; Sprint 1 20 and
  Sprint 2 97 passed, 0 failures. Nine added behavioral checks cover request
  idempotency, moderator-only approval/listing, missing requests, deadlines,
  claimed jobs, frontend transport and selective recovery error exposure.
- Evidence: s2-account-policy.test.mjs, s2-account-routes.test.mjs,
  s2-auth-lifecycle.test.mjs and s2-auth-routes.test.mjs.
- Limits: 42 inherited unrelated placeholders are not acceptance evidence.
  No live Firebase, Firestore emulator, deployed browser, email delivery or
  permanent erasure evidence is claimed. S2-AC-009 remains Pending.
