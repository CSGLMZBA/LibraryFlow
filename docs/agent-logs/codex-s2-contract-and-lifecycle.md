# Bryan Sprint 2 contract and lifecycle implementation

Owner: Bryan Alessandro Peralta Gutierrez. Assistant: Codex.
Scope: S2-T01 and S2-T06 only. No Sprint 3 implementation.
Status: In progress / ready for review of backend increment; live acceptance pending.

## Authorization and contract

Bryan explicitly requested amendment of the MD followed by implementation and
tests, and requested that the contract change be explained in a normal PR.
SPEC-002-CONTRACTS.md section 10 now records the chosen behavior. Only Bryan's
feature/S2-T01-bryan-firebase-auth may be updated remotely. Main, develop and
other contributors' branches must not be written. No PR merge is authorized.

Required documents were reviewed, including Starter.md, SPRINT-002.md,
SPEC-002.md, SPEC-002-CONTRACTS.md, task board, FIELD_RULES.md and related
registration/token/logout/deletion/restoration stories and collaborator logs.
S2-T06 continues against S2-T01's implemented contract while live dependency
acceptance remains pending. No task is marked Done on code existence alone.

## PR coordination

- develop at 18f2970 contains merged PR #15 (Juan) and #17 (Cesar).
- PR #18 (Dante), head 6b36c1d847bab7da1c32a3a4b1f52827f40d2133,
  remains open. Its auth types, cloud adapter, facade, App and application
  service were inspected. It expects synchronous getAccessToken().
- Preserved that synchronous call instead of requiring Dante's code to await
  a Promise. Firebase onIdTokenChanged keeps the token cache updated. Added
  a dedicated regression test. No session header or shared domain DTO change
  is required. Source files shared by the open PR may need textual conflict
  resolution by the integration owner; no open PR code was merged or altered.
- PR #16 is closed, unmerged; a new normal PR is requested for this increment.

## Implemented behavior

- Firestore transaction adapter with no in-memory fallback on production errors.
- Account state, digest-only Firebase session families, 30-minute idle checks,
  monotonic token replacement, account-wide revocation and ban/deletion denial.
- Passive session checks do not extend cloud idle time. Explicit refresh and
  protected actions do. Identical same-second tokens are not falsely described
  as distinct rotations; conservative same-second re-login is documented.
- Local IndexedDB authentication now enforces the idle boundary too.
- Explicit deletion confirmation, restriction, 30-day job, immutable audit and
  private queued-email outbox; interrupted public redaction is retryable.
- Current in-memory and matching Firestore public-data redaction hooks;
  deletion does not automatically re-expose personal content on restore.
- Narrow credential-only cancellation, moderator-only restoration, revision
  checks and transactional cancellation-vs-worker safeguards.
- Frontend lifecycle service hooks for settings consumers.
- Field-specific route errors and non-cacheable account/auth responses.

## Changed HTTP routes

Existing /api/v1/auth/register, /login, /session, /refresh and /logout are
preserved and use the clarified policy. Added the already-contracted URLs:

- POST /api/v1/account/deletion-request, body {confirm:true}.
- POST /api/v1/account/deletion-cancel, body {email,password}.
- POST /api/v1/moderation/accounts/:uid/restore, moderator, body {revision}.

No ban-writing endpoint or new role is introduced.

## Observed verification

- npm run typecheck: passed.
- npm run build: passed; existing large main-bundle warning remains.
- npm test: Sprint 1 20 passed, Sprint 2 88 passed, total 108, 0 failed.
- git diff --check: passed.
- Nine inherited account/session placeholder cases were removed and replaced
  by meaningful policy/router coverage. 42 unrelated placeholders remain;
  passing them is not evidence of complete Sprint 2 acceptance.
- Focused tests use actual service/router code with controlled clocks,
  transactional test storage and mocked Firebase/provider/HTTP boundaries.
- No live Firebase/Firestore, emulator, browser deployment, real email delivery
  or permanent worker execution is claimed.

## Remaining cross-owner work

Settings/recovery UI integration, email delivery/claiming, the permanent worker,
actual Firestore rules deployment and live acceptance need the responsible
owners. S2-AC-009 remains Pending. Email is explicitly queued, not sent.
Private collection rules and worker-cancellation requirements are documented.
The earlier npm audit result has 14 findings (5 high); no unrelated dependency
upgrade or release security clearance is included.

The implementation changes the agreed policy in the MD; the PR must call this
out so the integration owner can review it. It is a normal review request,
not an approval to merge or a declaration that the whole sprint is complete.

## Changed files in this continuation

- `apps/backend/src/middleware/auth-guard.ts`
- `apps/backend/src/repositories/auth-state-store.ts`
- `apps/backend/src/repositories/book-repository.ts`
- `apps/backend/src/repositories/comment-repository.ts`
- `apps/backend/src/routes/account-routes.ts`
- `apps/backend/src/routes/auth-routes.ts`
- `apps/backend/src/server.ts`
- `apps/backend/src/services/account-lifecycle-service.ts`
- `apps/backend/src/services/account-session-policy.ts`
- `apps/backend/src/services/auth-errors.ts`
- `apps/backend/src/services/firebase-auth-service.ts`
- `apps/frontend/src/services/account-lifecycle-service.ts`
- `apps/frontend/src/services/auth-cloud-adapter.ts`
- `apps/frontend/src/services/auth-service.ts`
- `apps/frontend/src/services/firebase-client.ts`
- `apps/frontend/src/types/auth.ts`
- `docs/agent-logs/codex-s2-contract-and-lifecycle.md`
- `docs/deployment/S2-AUTH-PRIVATE-COLLECTIONS.md`
- `docs/specs/S2-AUTH-ACCOUNT-PROPOSAL.md`
- `docs/specs/SPEC-002-CONTRACTS.md`
- `docs/testing/S2-ACCEPTANCE-REGISTER.md`
- `docs/testing/S2-AUTH-SESSION-HANDOFF.md`
- `docs/testing/s1-cross-cutting.test.mjs`
- `docs/testing/s2-account-policy.test.mjs`
- `docs/testing/s2-account-routes.test.mjs`
- `docs/testing/s2-auth-lifecycle.test.mjs`
- `docs/testing/s2-auth-routes.test.mjs`
- `docs/testing/s2-security-session.test.mjs`
- `package.json`

## Read-only open-PR merge preview

A git merge-tree preview against PR #18 was run without changing either branch.
App, auth types, frontend manifest and package-lock auto-merge. The two auth
service files overlap textually: auth-cloud-adapter.ts and auth-service.ts.
If PR #18 is integrated later, retain this SDK/policy implementation and its
synchronous getAccessToken API, along with Dante's application UI/service.
This preview is not a merge of the open PR and is not a claim of zero future
conflicts. The PR to current develop is a separate comparison.


## 2026-11-22 — moderator-request clarification

Owner Bryan authorized continuation of Sprint 2 and the MD amendment.
Pending-deletion login now advertises a cancellation request action. Password
proof creates an idempotent, private pending request with audit; it never
restores the account. Added moderator queue and explicit revision-checked
approval UI, backed by transactional request/job/account/audit updates.
SPEC-002 sections 6/10 and the private-rules handoff document this distinction.

Typecheck, production build and npm test passed: Sprint 1 20, Sprint 2 97,
0 failed. Build retains its existing >500 kB bundle warning. Live Firebase
and cross-owner worker/delivery acceptance remain pending; unrelated inherited
placeholder tests do not establish acceptance. Open #18 synchronous bearer
consumer remains compatible. Merged #15/#17 changes are retained. No main,
develop or colleague branch was written and no PR was merged.
