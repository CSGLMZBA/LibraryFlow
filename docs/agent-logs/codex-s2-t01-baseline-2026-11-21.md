# S2-T01 baseline review

- Date: 2026-11-21 (America/Mexico_City)
- Owner: Bryan Alessandro Peralta Gutierrez
- Assistant: Codex (agent name awaiting owner confirmation)
- Task: S2-T01, Sprint 2
- Status: Blocked by baseline test failure
- Sources: Starter.md; SPRINT-002.md; SPEC-002.md;
  SPEC-002-CONTRACTS.md sections 1, 6, 8, 9; task board;
  FIELD_RULES.md; US-REA-010, US-REA-019, US-REA-020;
  Vulcan publisher application log; Sentinel QA log.

## Repository review

- develop at 18f2970 includes merged PRs #15 and #17.
- PR #18 is open; its applicant UI is not merged into develop.
- PR #16 is closed, unmerged, and retains its draft flag.
- Bryan's source branch still contains 438babe and 524b781.
- Merged origin/develop into the local S2-T01 branch without conflicts.
- No remote branches or PR metadata were changed in this session.

## Observed verification

- npm ci --no-audit --no-fund: completed, 459 packages installed.
- Initial typecheck required the documented shared-package build on a fresh
  checkout. After npm run build -w @library-flow/shared, typecheck passed.
- npm run build: passed; Vite reported an existing large-chunk warning.
- npm test: could not start tsx because this environment denies its IPC pipe
  (listen EPERM). This is a runner limitation, not an assertion failure.
- Equivalent runner used to inspect the baseline:

```sh
node --import tsx --test docs/testing/auth-validation.test.mjs docs/testing/s1-cross-cutting.test.mjs docs/testing/s1-domain-acceptance.test.mjs docs/testing/s2-publisher-application.test.mjs docs/testing/s2-security-session.test.mjs docs/testing/s2-storage-deployment.test.mjs
```

Node reported 55 tests, 54 passed and 1 failed test-file entry. Multiple
passing Sprint 2 entries are placeholders containing assert.ok(true), so
these totals do not demonstrate Sprint 2 acceptance.

## Blocking defect

docs/testing/s2-publisher-application.test.mjs:23 imports
`notificationRepository,approve` from notification-repository.ts. That module
does not export approve. Module loading fails before application tests run:

```text
SyntaxError: The requested module ...notification-repository.ts does not
provide an export named 'approve'
```

Proposed first correction: remove the unused nonexistent import, then rerun
the baseline to discover any remaining failures. No implementation files or
tests have been edited. Following Starter.md section 3.5, further
implementation is paused pending owner direction.

## Authorized objective after baseline recovery

Continue S2-T01 session persistence, Firebase refresh/revocation/logout,
local/cloud role parity and fresh access-token retrieval compatible with
Dante's proposed AuthPort integration. Preserve all merged application code.
S2-T06 account lifecycle and live Firebase verification remain separate work.
Do not mark S2-AC-009 passed without actual scenario evidence.
