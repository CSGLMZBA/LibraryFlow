# S2-T01 session lifecycle increment

- Owner: Bryan Alessandro Peralta Gutierrez
- Assistant: Codex
- Date: 2026-11-21, America/Mexico_City
- Branch: feature/S2-T01-bryan-firebase-auth
- Sprint/task: Sprint 2, S2-T01
- Status: In progress; this increment is prepared for review
- Dependency: existing Sprint 1 authentication boundary
- Related integration: Juan's merged PR #15; Dante's open PR #18
- Sources acknowledged: Starter.md; SPRINT-002.md; SPEC-002.md;
  SPEC-002-CONTRACTS.md sections 1, 6, 8, 9; task board; FIELD_RULES.md;
  US-REA-010, US-REA-019, US-REA-020; relevant Vulcan and Sentinel logs.
- Owner requested continued implementation after the baseline blocker report.
  No remote push or PR mutation was performed.

## Changes and reason

The backend and frontend previously used memory-only cloud tokens, requiring
another login after reload. Added lazy Firebase Client SDK initialization,
IndexedDB persistence, forced renewal and backend verification of restored
sessions. Added getAccessToken() for Dante's protected API consumers and
refreshSession() to both adapters. Local public registration now assigns reader
regardless of a publisher request.

Added authenticated POST /api/v1/auth/refresh using an SDK-renewed bearer.
Existing /register, /login, /session and /logout remain. Every auth response
is non-cacheable. Shared backend verification rejects disabled users and
checks Firebase token revocation, distinguishing provider outages from invalid
credentials. Logout revokes the verified UID. Frontend teardown runs even if
the remote logout request fails; UI reports failure instead of claiming remote
revocation succeeded. Generation checks prevent stale responses after logout
or a newer login from changing session state.

Corrected the inherited nonexistent approve import in the publisher application
suite. Switched npm test scripts from the tsx CLI to Node's tsx loader to avoid
this execution environment's CLI IPC restriction and included new auth suites
in test:sprint2. No dependencies were added or upgraded.

## Observed verification

- Shared package build: passed after the fresh dependency install.
- npm run typecheck: passed.
- npm run build: passed. Existing main-bundle size warning remains; Firebase
  client loads in a separate dynamic chunk.
- npm test: Sprint 1 19 passed, 0 failed; Sprint 2 75 passed, 0 failed.
- Total: 94 reported tests, 0 failures. 51 inherited assert.ok(true)
  placeholders remain, so this is not full Sprint 2 acceptance.
- git diff --check: passed.
- npm audit --json: 14 findings, 9 moderate and 5 high; no critical findings.
  No audit remediation or security clearance is claimed.
- Final fetch: develop remains 18f2970; no newer changes to integrate.

New tests exercise client restore, fresh token retrieval, forced renewal,
verified login, revocation denial, network failures, local logout cleanup,
late-response and initialization races, backend UID/revocation verification,
disabled accounts, backend logout revocation and required-role rejection.
The existing IndexedDB test fixture also verifies local public role parity.

## Acceptance and remaining work

S2-AC-009 remains Pending. Mocked SDK/provider/transport tests are partial
engineering evidence only. No live Firebase configuration was provided and no
live browser, deployment or credential scenario was claimed.

The 30-minute inactivity rule remains unimplemented. TC-S2-045's old-token
invalidation expectation needs clarification: native SDK renewal does not
invalidate all previous unexpired ID tokens. That behavior needs an agreed
application-session policy before additional persistence is introduced.
S2-T06 account deletion/restore and account-ban enforcement are separate work.
Juan's application repository remains in memory and its role hooks require
cloud integration; this change does not mark those acceptance rows complete.

See docs/testing/S2-AUTH-SESSION-HANDOFF.md for configuration, Dante's client
call example, precise HTTP behavior and live scenarios still to execute.

## Changed files

- `.env.example`
- `apps/backend/src/middleware/auth-guard.ts`
- `apps/backend/src/routes/auth-routes.ts`
- `apps/backend/src/services/firebase-auth-service.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/contexts/AuthContext.tsx`
- `apps/frontend/src/services/auth-cloud-adapter.ts`
- `apps/frontend/src/services/auth-service.ts`
- `apps/frontend/src/services/firebase-client.ts`
- `apps/frontend/src/types/auth.ts`
- `docs/agent-logs/codex-s2-t01-baseline-2026-11-21.md`
- `docs/agent-logs/codex-s2-t01-session-2026-11-21.md`
- `docs/testing/S2-ACCEPTANCE-REGISTER.md`
- `docs/testing/S2-AUTH-SESSION-HANDOFF.md`
- `docs/testing/s1-cross-cutting.test.mjs`
- `docs/testing/s2-auth-lifecycle.test.mjs`
- `docs/testing/s2-publisher-application.test.mjs`
- `package.json`
