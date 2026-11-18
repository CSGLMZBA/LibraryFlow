# Sprint 1 Acceptance-Criteria Register

This register is the QA verification source of truth for Sprint 1 (`S1-DOC-02` and `S1-QA-01`). Each acceptance item maps to detailed test cases (`TC-*`) derived from the 15 Sprint 1 user stories and `docs/user_stories/FIELD_RULES.md`. No item may be marked `Passed` until implementation exists and actual verification evidence is recorded below.


## 1. Master Acceptance Summary

| ID | Scope / story | Acceptance coverage | Specification | Owner | Evidence required | Status |
|---|---|---|---|---|---|---|
| S1-AC-001 | PB-001 / `US-REA-010`, `US-MOD-010` | Registration, login, validation, roles, seeded accounts, session persistence | SPEC-001 §§3, 6, 11 | Bryan, Dante | Auth tests and invalid-credential manual check | In progress |
| S1-AC-002 | PB-002 / `US-PUB-001` | EPUB/PDF validation, 20 MB boundary, ownership, pending state, metadata update | SPEC-001 §§5, 8, 9 | Juan, Dante | API/service tests and upload boundary checks | In progress |
| S1-AC-003 | PB-002 / `US-MOD-006` | Approval/rejection visibility, reason, notification, deletion job | SPEC-001 §§8, 11.2 | Juan, Jorge | Moderation tests and scheduled-job retry evidence | In progress |
| S1-AC-004 | PB-003 / `US-REA-001`, `US-REA-011`, `US-PUB-002` | Case-insensitive query, combined filters, approved-only catalog, empty state | SPEC-001 §9 | Juan, Karlo | Query tests and empty-state manual check | In progress |
| S1-AC-005 | PB-004 / `US-PUB-004` | Owner-only metadata update and identity preservation | SPEC-001 §§5, 9 | Juan, Dante | Authorization and persistence tests | In progress |
| S1-AC-006 | PB-005 / `US-MOD-001`, `US-MOD-002`, `US-PUB-005` | Controlled category/genre references, rename preservation, filters | SPEC-001 §§5, 9, 12 | Juan, Dante, Karlo | Valid/invalid reference tests | In progress |
| S1-AC-007 | PB-006 / `US-REA-012`, `US-PUB-003`, `US-MOD-003` | Reader creation, publisher visibility, newest-first order, moderator removal audit and notification | SPEC-001 §§3, 9, 12 | Juan, Dante, Jorge | Comment and moderation tests | Failed (DEF-001) |
| S1-AC-008 | PB-007 / `US-REA-003` | Download states, retry, quota failure cleanup, offline reading | SPEC-001 §§5, 10 | Juan, Karlo | IndexedDB/download tests and offline manual check | In progress |
| S1-AC-009 | Cross-cutting / `FIELD_RULES.md` | Reload persistence, local/cloud boundary, malformed-data recovery, error shape, field rules | SPEC-001 §§7, 11.2, 15 | Cesar, Jorge | Regression and configuration evidence | Passed |

---

## 2. Detailed Traceable Test Cases (`S1-DOC-02`)

### 2.1 Authentication & Seeded Accounts (`S1-AC-001`: `US-REA-010`, `US-MOD-010`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-001 | `S1-AC-001` / `US-REA-010` `CA-001`, `CA-006` | Valid reader registration & default display name | Unauthenticated user; email `reader1@example.com` not registered | Submit registration with valid email and password (`ValidPass1!`) | Account created with role `reader`, password hashed (never plain text), display name formatted as `reader1` + 4 random digits, success feedback shown | Automated / UI | Not started |
| TC-002 | `S1-AC-001` / `US-REA-010` `CA-002` | Reject invalid/duplicate registration & enforce field limits | `reader1@example.com` already exists | 1) Submit malformed email; 2) Submit email > 50 chars; 3) Submit duplicate email; 4) Submit weak password (<8 chars, >20 chars, or missing uppercase/lowercase/digit/symbol); 5) Attempt public `moderator` role | Registration rejected in all cases with field-specific error without creating duplicate or privileged accounts | Automated | Not started |
| TC-003 | `S1-AC-001` / `US-REA-010` `CA-003` | Successful login & role-based UI access | Registered `reader` and `publisher` accounts | Log in with valid credentials for each role | Session persisted; authorized views for `reader` or `publisher` rendered | Automated / Manual | Not started |
| TC-004 | `S1-AC-001` / `US-REA-010` `CA-004` | Reject invalid login without credential enumeration | Registered account `reader1@example.com` | Attempt login with wrong password, then with unregistered email | Access denied (`401`) with identical non-enumerating error message | Automated / Manual | Not started |
| TC-005 | `S1-AC-001` / `US-REA-010` `CA-007` | Local mock auth parity & offline continuity | App running in local/test mode without network | Register and log in as reader, publisher, and moderator | Local mock auth exposes identical session/role contract as cloud adapter and works offline | Automated | Not started |
| TC-006 | `S1-AC-001` / `US-MOD-010` `CA-001`–`CA-003` | Seeded moderator, publisher, and reader accounts | Local/test environment initialized | Log in with seeded moderator, publisher, and reader credentials | Each seeded account logs in with its assigned role permissions (`moderator`, `publisher`, `reader`); note: credit/purchase features remain Out of Scope in Sprint 1 | Automated / Manual | Not started |
| TC-007 | `S1-AC-001` / `US-MOD-010` `CA-004` | Seeded account creation & reset scope check | Authenticated seeded moderator | Verify seeded account creation/reset utility or confirm Sprint 1 scope boundary (`US-REA-010` excludes general user admin) | Seeded test accounts reset cleanly per test cycle and are marked non-production | Automated | Not started |

### 2.2 Book Publishing & Lifecycle (`S1-AC-002`: `US-PUB-001`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-008 | `S1-AC-002` / `US-PUB-001` `CA-001`, `CA-004` | Submit valid EPUB/PDF book under 20 MB | Authenticated `publisher` | Submit title (≤ 100 chars), author, description, and valid `.epub` or `.pdf` file (< 20 MB) | Unique book ID and access key generated, owner set to authenticated publisher, status set to `pending`, hidden from public catalog | Automated / UI | Not started |
| TC-009 | `S1-AC-002` / `US-PUB-001` `CA-002` | Reject missing fields, >100 char title, or duplicate title+author | Authenticated `publisher`; book `"Dune"` by `"Frank Herbert"` exists | 1) Submit empty required field; 2) Submit title with 101 chars; 3) Submit duplicate `"Dune"` + `"Frank Herbert"` | Submission rejected with specific field error; no record or file stored | Automated | Not started |
| TC-010 | `S1-AC-002` / `US-PUB-001` `CA-007` | Enforce EPUB/PDF MIME/extension and 20 MB boundary | Authenticated `publisher` | 1) Upload `.exe`/`.txt` file; 2) Upload `20 MB + 1 byte` file; 3) Upload exact `20 MB` valid PDF | Invalid type and `> 20 MB` rejected without storing in bucket; exact `20 MB` accepted | Automated | Not started |
| TC-011 | `S1-AC-002` / `US-PUB-001` `CA-003`, `CA-006` | Public book details & unique shareable URL after approval | Book approved by moderator | Open approved book as reader/visitor | Unique URL resolves and displays title, author, description, publisher, publication date, and read/download actions | Manual / UI | Not started |
| TC-012 | `S1-AC-002` / `US-PUB-001` `CA-005` | Publisher manages own books only | Publisher A owns Book 1; Publisher B owns Book 2 | Publisher A lists dashboard and attempts edit/delete on Book 1 vs Book 2 | Publisher A can manage Book 1; attempt on Book 2 is rejected (`403`) | Automated | Not started |
| TC-013 | `S1-AC-002` / `US-PUB-001` `CA-008` | Rejected book state, notification, and 24h deletion schedule | Pending book submitted by Publisher A | Moderator rejects book with reason | Status becomes `rejected`, immediate in-app notification created for Publisher A, bucket file scheduled for deletion at `rejectedAt + 24h`, inaccessible publicly | Automated | Not started |

### 2.3 Book Moderation (`S1-AC-003`: `US-MOD-006`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-014 | `S1-AC-003` / `US-MOD-006` `CA-001` | Moderator approves pending book | Authenticated `moderator`; book in `pending` state | Select pending book and confirm approval | Book status updated to `approved` in persistence; book immediately queryable in public library | Automated | Not started |
| TC-015 | `S1-AC-003` / `US-MOD-006` `CA-002` | Moderator rejects pending book with reason & 24h cleanup | Authenticated `moderator`; book in `pending` state | Reject book with non-empty reason (≤ 500 chars); attempt rejection with empty reason or > 500 chars | Valid rejection marks `rejected`, sends in-app notification with reason, schedules 24h deletion job (and supports retry); invalid reason rejected | Automated | Not started |
| TC-016 | `S1-AC-003` / `US-MOD-006` `RN-001` | Reject non-moderator approval/rejection attempts | Authenticated `reader` or `publisher` | Call approve/reject endpoint on pending book | Request rejected with `403` authorization error; book remains `pending` | Automated | Not started |

### 2.4 Catalog Search & Filtering (`S1-AC-004`: `US-REA-001`, `US-REA-011`, `US-PUB-002`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-017 | `S1-AC-004` / `US-REA-001` `CA-001`, `US-REA-011` `CA-001`, `US-PUB-002` `CA-001` | Case-insensitive text search & default catalog on empty query | Approved, pending, and rejected books exist | 1) Query with empty string; 2) Query uppercase/lowercase substrings of title, author, and publisher | Empty query returns all `approved` books only; text query matches case-insensitively and excludes `pending`/`rejected` books | Automated | Not started |
| TC-018 | `S1-AC-004` / `US-REA-001` `CA-002`, `US-REA-011` `CA-002`, `US-PUB-002` `CA-002` | Filter by category and genre | Approved books assigned to distinct categories and genres | Filter catalog by single category, single genre, and multiple filters | Only `approved` books matching the selected category/genre metadata are returned | Automated | Not started |
| TC-019 | `S1-AC-004` / `US-REA-001` `CA-003`, `US-REA-011` `CA-003`, `US-PUB-002` `CA-003` | Combined text query + category/genre filters | Approved books across multiple categories/genres | Execute search combining text substring + category + genre | Returned books satisfy every selected condition simultaneously | Automated | Not started |
| TC-020 | `S1-AC-004` / `US-REA-001` `CA-004`, `US-REA-011` `CA-004`, `US-PUB-002` `CA-004` | Empty-state handling when no books match | Approved books exist | Search with non-matching query `"zzz-nonexistent-999"` | Empty result set returned with explicit empty-state UI message and zero unrelated books | Automated / Manual | Not started |

### 2.5 Book Metadata Updates (`S1-AC-005`: `US-PUB-004`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-021 | `S1-AC-005` / `US-PUB-004` `CA-001`, `CA-002` | Owner updates book metadata & preserves identity | Publisher A owns Book 1 | Update title, description, or author with valid values; reload session | New metadata persisted and visible; `id`, `ownerId`, and publication history remain unchanged | Automated | Not started |
| TC-022 | `S1-AC-005` / `US-PUB-004` `CA-003` | Reject non-owner or invalid metadata updates | Publisher A owns Book 1; Publisher B authenticated | 1) Publisher B attempts update on Book 1; 2) Publisher A submits empty title or title > 100 chars | Update rejected (`403` or `400`); existing book metadata remains completely unmodified | Automated | Not started |

### 2.6 Categories, Genres & Book Classification (`S1-AC-006`: `US-MOD-001`, `US-MOD-002`, `US-PUB-005`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-023 | `S1-AC-006` / `US-MOD-001` `CA-001`–`CA-003` | Create, rename, and validate categories | Authenticated `moderator` and non-moderator | 1) Create unique category (≤ 50 chars); 2) Rename category with assigned books; 3) Submit empty, > 50 chars, or duplicate name; 4) Attempt as reader | Valid create/rename succeeds without losing book links; invalid/duplicate or unauthorized request rejected with clear error | Automated | Not started |
| TC-024 | `S1-AC-006` / `US-MOD-002` `CA-001`–`CA-003` | Create, rename, and validate genres | Authenticated `moderator` and non-moderator | 1) Create unique genre (≤ 50 chars); 2) Rename genre with assigned books; 3) Submit duplicate/empty name; 4) Attempt as publisher | Valid create/rename succeeds preserving book associations; duplicate/invalid or unauthorized request rejected | Automated | Not started |
| TC-025 | `S1-AC-006` / `US-PUB-005` `CA-001`, `CA-002`, `CA-004` | Assign and update valid classifications on owned book | Owning publisher; valid category and genre IDs exist | Assign category and genre to book, then replace with new valid values, then search by new classification | New classifications persist, old values are replaced, and book appears in discovery filter results | Automated | Not started |
| TC-026 | `S1-AC-006` / `US-PUB-005` `CA-003`, `RN-001` | Reject nonexistent classification IDs or unauthorized user | Valid book exists; invalid ID `"cat-does-not-exist"` | 1) Submit nonexistent category or genre ID; 2) Non-owner attempts classification | Change rejected identifying invalid classification value or authorization error | Automated | Not started |

### 2.7 Comments & Comment Moderation (`S1-AC-007`: `US-REA-012`, `US-PUB-003`, `US-MOD-003`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-027 | `S1-AC-007` / `US-REA-012` `CA-001`, `CA-004` | Publish valid comment & newest-first ordering | Authenticated `reader`; approved book exists | Post Comment A (`t=1`), then Comment B (`t=2`) with surrounding whitespace; fetch book comments | Text trimmed/normalized (≤ 1000 chars), attached to book with author and timestamp, returned with Comment B before Comment A | Automated | Not started |
| TC-028 | `S1-AC-007` / `US-REA-012` `CA-002`, `CA-003` | Reject empty/whitespace comments & unauthenticated users | Approved book exists | 1) Authenticated reader submits `""` or `"   "`; 2) Unauthenticated visitor submits valid text | Both attempts rejected (`400` validation error / `401` login prompt); zero comments created | Automated / Manual | Not started |
| TC-029 | `S1-AC-007` / `US-PUB-003` `CA-001`–`CA-004` | Publisher comment isolation, empty state, and read-only enforcement | Book 1 has comments; Book 2 has 0 comments | 1) View Book 1 vs Book 2 comments; 2) Attempt publisher edit/delete of reader comment; 3) Reload after moderator deletion | Book 1 shows only its comments; Book 2 shows empty-state; publisher cannot alter comments; moderated comment disappears on reload | Automated / UI | Not started |
| TC-030 | `S1-AC-007` / `US-MOD-003` `CA-001`–`CA-004`, `US-REA-012` `CA-005` | Moderator comment deletion, confirmation cancel, audit log, and notification | Authenticated `moderator` and `reader`; comment exists | 1) Trigger delete and cancel confirmation; 2) Non-moderator attempts delete; 3) Moderator confirms delete with reason | Cancel leaves comment visible; non-moderator gets `403`; confirmed delete hides comment, soft-deletes record, stores audit (`moderatorId`, `commentId`, `reason`, `deletedAt`), and notifies author | Automated / UI | Not started |

### 2.8 Offline Downloads & Reading (`S1-AC-008`: `US-REA-003`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-031 | `S1-AC-008` / `US-REA-003` `CA-001`, `CA-004` | Download approved book & state transitions | Approved book with EPUB/PDF content | Trigger download and observe state transitions | State transitions `Not Started` -> `In Progress` -> `Completed`; complete file stored in IndexedDB with matching title and author | Automated / UI | Not started |
| TC-032 | `S1-AC-008` / `US-REA-003` `CA-002` | Read downloaded book offline | Book download state is `Completed` | Disable network connection and open downloaded book | Book opens and renders from IndexedDB showing matching title and author | Manual / UI | Not started |
| TC-033 | `S1-AC-008` / `US-REA-003` `CA-003`, `RN-001`, `RN-006` | Handle download failure, quota exceeded, and private book block | 1) Simulated network/quota error; 2) Pending/rejected book | Attempt download under failure/quota limit, then retry; attempt download of non-approved book | Failure sets state to `Failed`, cleans up incomplete copy, displays actionable error and retry option; retry succeeds; non-approved book blocked | Automated | Not started |

### 2.9 Cross-Cutting & Global Field Rules (`S1-AC-009`: `SPEC-001` §§7, 11.2, 15 & `FIELD_RULES.md`)

| Test ID | AC / Story | Criterion | Preconditions | Steps | Expected Result | Type | Status |
|---|---|---|---|---|---|---|---|
| TC-034 | `S1-AC-009` / `SPEC-001` §7 | Persistence across full reload | Active session, created books, comments, and offline download in IndexedDB | Reload browser/application context and query repositories | Session, books, comments, and completed offline downloads persist intact after reload | Automated / Manual | Not started |
| TC-035 | `S1-AC-009` / `SPEC-001` §§7, 11.2 | Malformed/corrupt IndexedDB data recovery | Corrupt JSON or missing required fields injected into IndexedDB stores | Initialize auth, book, and comment repositories | Repositories catch malformed records gracefully without unhandled exceptions and return recoverable error state | Automated | Not started |
| TC-036 | `S1-AC-009` / `SPEC-001` §11 | Standard `/api/v1` error JSON envelope & secret hygiene | Backend Express routes active | Trigger `400`, `401`, `403`, `404`, and `409` errors across endpoints | Every error response matches `{ success: false, error: { code, message, field } }` with zero password hashes or stack traces exposed | Automated | Not started |
| TC-037 | `S1-AC-009` / `SPEC-001` §§7, 11.2 | Local vs. cloud adapter boundary (`APP_MODE`) | Local mock adapters and cloud boundary adapters configured | Run contract checks in local mode without cloud credentials | Local mode operates cleanly without network calls and honors the same domain interfaces as cloud mode | Automated | Not started |
| TC-038 | `S1-AC-009` / `FIELD_RULES.md` Rules 1–8 | Global field validation rules & length limits | Validation schemas in `packages/shared` and `apps/*` | Verify required fields (Rule 1), default 25-char limit & approved overrides (`50`, `8–20`/`8–128`, `100`, `500`, `1000`) (Rule 2), formats (Rule 3), uniqueness (Rule 4), optional fields (Rule 6), non-negative numbers (Rule 7), and `YYYY-MM-DD` dates (Rule 8) | All schemas reject violations before persistence and allow valid optional fields when omitted | Automated | Not started |

---

## 3. Execution Record & Evidence Log

No acceptance item is marked `Passed` until implementation exists and the verification has actually run.

| Date (UTC) | AC / Test IDs | Command or Manual Scenario | Result | Defect / Notes |
|---|---|---|---|---|
| 2026-11-18 | Pre-check (`S1-AC-001`–`009`) | `npm run typecheck` | Pass (0 errors) | Workspace typecheck passes across `@library-flow/shared`, `@library-flow/backend`, and `@library-flow/frontend`[cite: 5]. |
| 2026-11-18 | `S1-AC-001` (`TC-001`–`TC-004`) | `npx tsx --test docs/testing/auth-validation.test.mjs` | Pass (9/9) | Automated auth validation and guard tests pass; manual invalid-credential UI check pending for final sign-off. |
| 2026-11-18 | `S1-AC-009` (`TC-034`, `TC-035`, `TC-037`, `TC-038`) | `npx tsx --test docs/testing/s1-cross-cutting.test.mjs` | Pass (4/4) | Verified shared field limits (`limits.ts`), IndexedDB reload persistence, corrupt-record resilience, and offline quota cleanup (`QuotaExceededError`). |
| 2026-11-18 | `S1-AC-002`–`S1-AC-006` (`TC-008`–`TC-024`) | `npx tsx --test docs/testing/s1-domain-acceptance.test.mjs` | Pass (4/5 suites) | Book upload/20MB boundary, moderation approval/rejection +24h schedule, owner-only metadata updates, search filters, and unique classifications passed[cite: 10]; UI manual checks pending. |
| 2026-11-18 | `S1-AC-007` (`TC-027`, `TC-030`) | `npx tsx --test docs/testing/s1-domain-acceptance.test.mjs` | Fail (1/5 suites) | Backend comment creation and moderation soft-delete/notification passed, but frontend `commentRepository.getCommentsByBookId` returns oldest-first (`DEF-001`)[cite: 10]. |

## 4. Defect Log (`S1-QA-01`)

| Defect ID | Related AC / TC | Severity | Summary | Assigned Owner | Status | Re-test Evidence |
|---|---|---|---|---|---|---|
| DEF-001 | `S1-AC-007` / `TC-027` (`US-REA-012` `CA-004`) | Medium | `apps/frontend/src/repositories/comment-repository.ts` sorts comments ascending (`a.createdAt.localeCompare(b.createdAt)`) instead of descending newest-first (`b.createdAt.localeCompare(a.createdAt)`)[cite: 10]. | Karlo / Dante (Frontend) | Open | Pending fix and re-run of `npx tsx --test docs/testing/s1-domain-acceptance.test.mjs` |
| DEF-002 | `S1-AC-009` (`SPEC-002` §2, `SPEC-000` §6.3) | Low | Repository hygiene: `.gitkeep` placeholders remain in populated directories (`apps/frontend/src/*`, `packages/shared/src/*`) and `packages/shared/tsconfig.tsbuildinfo` is tracked in Git[cite: 9]. | Jorge / Juan | Open | Pending cleanup check on `develop` |