# Vulcan — Publisher Applications

Date: 2026-11-20

## Assignment

- Task: `S2-T02`
- Owner: Juan Carlos Zúñiga Alfaro
- Agent: Vulcan
- Sprint: Sprint 2
- Status: Done

## Scope

Implemented the shared application contract and backend application layer
required by `SPEC-002-CONTRACTS.md` §2:

- Shared `PublisherApplicationStatus`, `PublisherApplication`,
  `CreatePublisherApplicationDto`, and `ReviewPublisherApplicationDto`.
- Shared application field limits and 30-day expiration limit.
- Defensive in-memory `PublisherApplicationRepository`.
- `PublisherApplicationService` validation, active-application uniqueness,
  expiration, withdrawal, approval, rejection, and revocation behavior.
- Application and moderation controllers and routes.
- Applicant and moderator API route mounting.
- Focused automated acceptance coverage for `S2-AC-001`, `S2-AC-002`, and
  `S2-AC-003`.

## Verification

Observed commands and results:

- `npm run build -w @library-flow/shared`: passed.
- `npm run build -w @library-flow/backend`: passed.
- `npm run build`: passed across shared, backend, and frontend workspaces.
- `npx tsx --test docs/testing/s2-publisher-application.test.mjs`: passed,
  with 5 tests passed and 0 failed.

## Test Evidence

The focused suite verified:

- Valid reader submission creates a pending application with revision 1 and
  a 30-day expiration.
- A second submission is rejected while a pending application exists.
- Withdrawal changes the application to `withdrawn`, increments revision, and
  permits resubmission.
- Approval changes the status to `approved`, records the moderator UID, and
  dispatches `publisher_application_approved`.
- Rejection requires a reason, preserves the reason, changes the status to
  `rejected`, and dispatches `publisher_application_rejected`.

## Changed Deliverables

- `packages/shared/src/types/publisher-application.ts`
- `packages/shared/src/schemas/limits.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/types/notification.ts`
- `apps/backend/src/repositories/publisher-application-repository.ts`
- `apps/backend/src/services/publisher-application-service.ts`
- `apps/backend/src/controllers/publisher-application-controller.ts`
- `apps/backend/src/routes/publisher-application-routes.ts`
- `apps/backend/src/routes/moderation-routes.ts`
- `apps/backend/src/server.ts`
- `docs/testing/s2-publisher-application.test.mjs`
- `docs/testing/S2-ACCEPTANCE-REGISTER.md`

