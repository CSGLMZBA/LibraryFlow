
# GPT-6 — S2-T05: Reader Application Status UI

## Identity

- Agent: GPT-6 (ChatGPT)
- Owner: Karlo Silvestre de la Cruz Flores
- Sprint: 2
- Task: S2-T05
- Branch: feature/S2-T05-status-ui
- Date: 2026-11-22
- Status: In progress

## Scope

First of three planned S2-T05 deliveries.

Implement the authenticated reader application status view.
Withdrawal and offline caching are reserved for later branches.

## References

- docs/agent-prompts/Starter.md
- docs/sprints/SPRINT-002.md
- docs/sprints/SPRINT-002-003-TASK-BOARD.md
- docs/specs/SPEC-002-CONTRACTS.md
- docs/user_stories/REA/US-REA-013-RequestPublisherStatus.md

## Dependency

- S2-T02: Publisher application API and shared DTOs.
- Reuse the existing S2-T04 frontend application service.

## Acceptance References

- S2-AC-001
- S2-AC-003

## Planned Changes

- Add ReaderApplicationStatus.tsx.
- Integrate reader-only navigation in App.tsx.
- Reuse publisherApplicationService.listMyApplications().
- Display pending, approved, rejected, withdrawn, and expired states.
- Handle loading, empty, error, and retry states.

## Known Issues

- The existing Sprint 2 test suite fails because of an invalid
  "approve" import in s2-publisher-application.test.mjs.
- Live API verification requires a valid cloud authentication token.
- Offline caching and application withdrawal are outside this branch.

## Verification

Pending execution after local implementation:

- npm run typecheck
- npm run build
- npm test
- Manual reader navigation and application-status scenarios

No new acceptance scenario is claimed as passed.

- TypeScript typecheck: Passed.
- Production build: Passed.
- Sprint 1 tests: 18 passed.
- Sprint 2 tests: Blocked by a pre-existing invalid import
  in s2-publisher-application.test.mjs.
- Reader-only navigation: Visually verified.
- Application status page: Rendered successfully.
- Authentication error state: Visually verified.
- Refresh status: Click handler verified.
- Try again: Click handler verified.
- Back to catalog: Visually verified.

## Pending Verification

- Real authenticated API response.
- Pending, approved, rejected, withdrawn, and expired states.
- Empty application list.
- Network failure and successful retry.