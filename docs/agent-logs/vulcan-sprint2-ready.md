# Vulcan — Sprint 2 Readiness

Date: 2026-11-20

## Agent and owner

- Agent: Vulcan, AI assistant using Copilot SDK in VS Code
- Owner: Juan Carlos Zúñiga Alfaro, Backend / Data and Storage Engineer

## Sprint 2 acknowledgement

I have read and acknowledged:

- `docs/agent-prompts/Starter.md`
- `docs/sprints/SPRINT-002.md`
- `docs/specs/SPEC-002.md`
- `docs/specs/SPEC-002-CONTRACTS.md`
- `docs/sprints/SPRINT-002-003-TASK-BOARD.md`
- `docs/user_stories/REA/US-REA-013-RequestPublisherStatus.md`
- `docs/user_stories/MOD/US-MOD-005-ApprovePublishers.md`
- `docs/user_stories/MOD/US-MOD-007-RemovePublishers.md`
- `docs/user_stories/FIELD_RULES.md`
- Recent relevant agent logs in `docs/agent-logs/`

I acknowledge the Sprint 2 contracts, including the `/api/v1` API envelope,
reader-only application submission, one active application per reader,
terminal application states, server-side authorization, atomic approval,
explicit validation and revision behavior, and the requirement that rejected
or withdrawn applications preserve reader status.

I acknowledge the role boundaries: Juan owns application persistence, shared
DTOs, route names, and repository behavior; Bryan owns server identity and
authentication; Dante and Karlo consume the shared application contract for
UI work; Carlos owns integration approval; and Cesar owns acceptance evidence.

I will use the required commit format:

```text
<type>(<scope>) [JUAN CARLOS ZUÑIGA ALFARO]: <description>
```

I will follow the required workflow: remain within the bounded task, preserve
the normative contract, report prerequisites and verification commands, obtain
owner confirmation before implementation, run the required baseline checks
before handoff, record evidence only after execution, and never push without
explicit owner authorization.

## First assigned task — five pre-implementation points

1. **Agent, owner, and status**  
   Agent: Vulcan. Owner: Juan Carlos Zúñiga Alfaro. Status: `Not started`.

2. **Task identity and bounded objective**  
   Task-board ID: `S2-T02`. Sprint: Sprint 2. Objective: implement application
   DTOs, repository behavior, field validation, active-application
   uniqueness, and the contract-defined application state transitions. The
   task must satisfy acceptance IDs `S2-AC-001`, `S2-AC-002`, and
   `S2-AC-003`. Dependency: `S2-T01` auth contract must be complete before
   implementation.

3. **Stories and contract sections**  
   Relevant stories: `US-REA-013`, `US-MOD-005`, and `US-MOD-007`.
   Primary contract: `docs/specs/SPEC-002-CONTRACTS.md` §2, including
   sections §2.1 Data model, §2.2 State transitions, and §2.3 Routes.
   Related contract requirements include §1 common API/error behavior and §3
   revision handling. The implementation must preserve the reader role on
   rejection, withdrawal, and expiration, and must keep approval atomic.

4. **Expected files and routes**  
   Expected backend/shared changes are limited to the existing shared
   application DTO/type and validation areas, application repository/service/
   controller/route areas, and focused application repository or service
   tests, subject to the repository's existing structure. Expected contract
   routes are:

   - `POST /api/v1/publisher-applications`
   - `GET /api/v1/publisher-applications/me`
   - `POST /api/v1/publisher-applications/:id/withdraw`
   - `GET /api/v1/moderation/publisher-applications?status=pending`
   - `POST /api/v1/moderation/publisher-applications/:id/approve`
   - `POST /api/v1/moderation/publisher-applications/:id/reject`
   - `POST /api/v1/moderation/publishers/:uid/revoke`

   No frontend implementation, dependency manifest, or uncontracted route is
   in scope.

5. **Exact verification commands**  
   After owner confirmation and implementation, run the focused application
   repository/state-transition tests, then the required baseline commands:

   ```text
   npm run typecheck
   npm run build
   npm test
   ```

   Record the exact focused test command once the repository test runner and
   test file location are confirmed. Acceptance evidence must cover
   submission/validation, duplicate active application rejection, approval,
   rejection with reason, withdrawal, and the role/state invariants.

## Confirmation gate

No implementation files, dependencies, tests, builds, or verification
commands have been changed or run for S2-T02. I am awaiting explicit owner
confirmation of this five-point summary before writing feature code or running
the required preflight commands.
