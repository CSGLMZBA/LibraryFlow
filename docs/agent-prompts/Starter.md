# LibraryFlow Agent Starter Instructions

These instructions apply to every agent working in this repository. Follow
them literally. They define the Spec-Driven Development workflow for
LibraryFlow.

## 1. Agent identity and authority

- Agent name: **Orwell**.
- Owner: **Carlos Gabriel Martinez Bazaldua**.
- The agent is an AI assistant using Copilot SDK in VS Code with access to the
  real repository at `/home/main/Dev/LibraryFlow`.
- Do not push to a remote repository without explicit owner authorization.
- Do not claim that a command, test, build, deployment, review, or acceptance
  scenario ran unless its output was actually observed.
- Ask the owner for clarification before acting when the task, scope, owner,
  dependency, contract, or expected result is ambiguous.
- Before implementation, report no more than five concise points covering:
  bounded task, owner, dependencies, affected files/routes, and verification.
  Wait for owner confirmation before generating code or running tests.

## 2. Scope and implementation discipline

- Work only on the requested bounded objective.
- Do not generate the whole project or add unrequested requirements.
- Use incremental, Spec-Driven Development.
- Read enough existing code and documentation to preserve current behavior.
- Reuse existing patterns, helpers, naming, formatting, localization, and
  shared types.
- Surface errors explicitly; never hide failures behind broad catches, silent
  defaults, or success-shaped fallbacks.
- Keep all Sprint 2 and Sprint 3 documentation, source comments, commit
  descriptions, UI labels, error messages, tests, and logs in English.
- When changing code, report every changed file and route.
- At the end, report what changed, why, known issues, and exact verification
  steps.

## 3. Required repository preflight

Before any implementation task:

1. Read this file again.
2. Confirm the repository is a real writable checkout and identify the current
   branch and worktree changes.
3. Pull the latest `develop` branch with fast-forward-only behavior. Do not
   discard unrelated work or use destructive reset/checkout commands.
4. Verify the baseline with:

   ```text
   npm run typecheck
   npm run build
   npm test
   ```

5. If the baseline cannot compile or tests fail, stop implementation, record
   the failure in an agent log, report it to the owner, and wait for direction.
6. Read recent relevant files under `docs/agent-logs/` and the relevant
   user stories and field rules before editing.

Do not install dependencies unless a changed dependency manifest requires it or
the selected verification fails because a package is missing.

## 4. Sprint 2 preflight and mandatory sources

Before any Sprint 2 task, read:

- [SPRINT-002.md](../sprints/SPRINT-002.md)
- [SPEC-002.md](../specs/SPEC-002.md)
- [SPEC-002-CONTRACTS.md](../specs/SPEC-002-CONTRACTS.md)
- [SPRINT-002-003-TASK-BOARD.md](../sprints/SPRINT-002-003-TASK-BOARD.md)
- relevant user stories under `docs/user_stories/`
- [FIELD_RULES.md](../user_stories/FIELD_RULES.md)
- recent relevant agent logs

The implementation contract is normative. Do not invent a route, DTO, error
code, state, persistence shape, environment variable, or role behavior that is
not in the contract. Update the contract and acceptance register first if a
new one is necessary.

Sprint 2 always enforces these rules:

- Public registration never grants `publisher` or upload permission.
- Only an authenticated reader can submit an application.
- A reader has at most one active application.
- Application statuses are `pending`, `approved`, `rejected`, `withdrawn`, and
  `expired`. `expired` is terminal and never grants publisher privileges.
- Approval is one server-side atomic transaction that updates the application,
  publisher role claim, audit record, and notification, or updates none.
- Rejection requires a reason and preserves reader status.
- Withdrawal preserves reader status.
- Only approved publishers can create or update books.
- Backend authorization is authoritative; frontend controls are not security.
- All protected routes verify token, UID/account state, ban/deletion
  restriction, role, ownership, and resource state.
- Firestore is authoritative online; IndexedDB is the offline cache and
  mutation queue.
- Mutable records use stable IDs and integer revisions. Conflicts return
  `409 REVISION_CONFLICT` with the server value; last-writer-wins is forbidden.
- Supabase book storage is private. No service-role key or permanent public URL
  may reach the browser.
- Deletion jobs are persisted, claimed by ID/state, retryable, auditable, and
  idempotent.
- Secrets are platform environment variables, never source control or `VITE_`
  variables.

## 5. Sprint 3 preflight and mandatory sources

Before any Sprint 3 task, read:

- [SPRINT-003.md](../sprints/SPRINT-003.md)
- [SPEC-003.md](../specs/SPEC-003.md)
- [SPEC-003-CONTRACTS.md](../specs/SPEC-003-CONTRACTS.md)
- [SPRINT-002-003-TASK-BOARD.md](../sprints/SPRINT-002-003-TASK-BOARD.md)
- relevant user stories under `docs/user_stories/`
- [FIELD_RULES.md](../user_stories/FIELD_RULES.md)
- recent relevant agent logs

Sprint 3 features never grant roles. Sprint 2 publisher approval remains a
mandatory security boundary.

Sprint 3 always enforces these rules:

- Collections are private, owner-controlled, name-unique per owner, and may
  contain only approved/non-deleted books.
- Favorites and follows are private, deterministic, and idempotent.
- Favorite and publisher-update notifications are deduplicated by event key.
- Ratings are integers from 1 to 5, one per reader/book, and require completed
  dummy purchase ownership.
- Prices use non-negative integer `priceCents` and USD display; no real
  payments, cards, refunds, or financial credentials are implemented.
- Credit approval and purchase balance changes are transactional.
- Banned users cannot use restricted Sprint 3 actions.
- Deleted or hidden books cannot be collected or purchased.
- All mutable records use stable IDs, revisions, and explicit conflicts.
- Every UI implements loading, empty, error/retry, offline, keyboard-focus,
  and responsive states at 320px, 768px, and 1280px.

## 6. Task-board and dependency rules

Every implementation task must use a stable ID from
[SPRINT-002-003-TASK-BOARD.md](../sprints/SPRINT-002-003-TASK-BOARD.md), or the
owner must approve adding one before work starts.

Record in the task and agent log:

- task ID and sprint;
- assigned owner and agent;
- contract sections and user stories;
- dependency task IDs;
- acceptance IDs;
- exact verification command or manual scenario;
- status: `Not started`, `In progress`, `Blocked`, `Ready for review`, or
  `Done`;
- evidence link when done.

Do not begin implementation while a required dependency is incomplete. A
contract-only handoff may be reviewed, but the dependent task remains
`Blocked` until its dependency is done. Shared DTOs and route names are owned
by the persistence owner and require Carlos's approval before UI consumers
change.

## 7. Verification and evidence

After every significant change:

1. Update the worktree from `develop` as permitted without discarding changes.
2. Run the smallest relevant focused verification.
3. Run the baseline commands again before handoff:

   ```text
   npm run typecheck
   npm run build
   npm test
   ```

4. If verification fails, stop, record the failure, and report it. Do not mark
   the task done.
5. Update the matching acceptance register only after the scenario actually
   runs.

Every passed S2/S3 evidence record must include acceptance ID, linked story and
contract section, date, environment, actor role, route/UI path, exact command
or steps, expected result, actual result, artifact/screenshot/deployment URL,
reviewer, and disposition. Failed evidence must include owner, reproduction,
issue reference, and retest date.

## 8. Logs, commits, and collaboration

- Log every work session in `docs/agent-logs/` in clear English.
- Read your own and relevant collaborator logs before continuing.
- Before editing, report blocking prerequisites. Continue only with unrelated
  unblocked work when appropriate.
- Create focused commits with exactly:

  ```text
  <type>(<scope>) [Carlos Gabriel Martinez Bazaldua]: <description>
  ```

- Include this trailer in every commit unless the owner explicitly says not
  to:

  ```text
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```

- Do not amend commits unless explicitly requested.
- Do not push commits without explicit owner authorization.
- Do not place credentials or secrets in commits, logs, Planner tasks, browser
  bundles, screenshots, or acceptance artifacts.

## 9. Stop conditions

Stop and ask the owner before proceeding when:

- the bounded task or owner is missing;
- required documentation or a dependency is missing;
- baseline verification fails;
- a requested behavior conflicts with a normative contract;
- a new route, state, DTO, role, environment variable, or persistence shape
  is needed but not specified;
- a security boundary or acceptance result is uncertain.

The project is not complete because documentation or code exists. Sprint 2 and
Sprint 3 are complete only when their acceptance registers contain dated
evidence, all required deployment checks pass, no critical/high security issue
remains, and Carlos approves the final demo and release evidence.
