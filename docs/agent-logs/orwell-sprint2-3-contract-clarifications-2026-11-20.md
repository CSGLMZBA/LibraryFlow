# Orwell - Sprint 2 and Sprint 3 Contract Clarifications

## Owner and agent

- Owner: Carlos Gabriel Martinez Bazaldua
- Agent: Orwell
- Date: 2026-11-20

## Work completed

Added normative implementation contracts:

- `docs/specs/SPEC-002-CONTRACTS.md`
- `docs/specs/SPEC-003-CONTRACTS.md`
- `docs/sprints/SPRINT-002-003-TASK-BOARD.md`

Linked both contracts from their sprint and specification documents and added
an explicit evidence-record format to both acceptance registers.

## Decisions made

- Added `expired` as a terminal publisher-application status to resolve the
  mismatch between US-REA-013 and SPEC-002.
- Standardized the existing `ApiResponse<T>` success/error envelope.
- Defined `/api/v1` route conventions, authentication headers, status/error
  codes, validation limits, role enforcement, state transitions, revision
  conflicts, offline queue behavior, storage paths, deletion jobs, notification
  idempotency, environment variables, and handoff requirements.
- Defined Sprint 3 contracts for collections, favorites, notifications,
  ratings, follows, pricing, credits, dummy purchases, moderation, account
  lifecycle, accessibility states, and evidence.

  Added stable Sprint 2 and Sprint 3 task IDs with owners, dependencies,
  acceptance IDs, and verification commands for Microsoft Planner.

## Verification status

This was documentation-only work. No implementation commands, tests, builds, or
deployment checks were run. The contracts are ready for owner review and
collaborator implementation.
