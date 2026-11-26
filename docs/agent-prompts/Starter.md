# LibraryFlow Agent Starter Instructions

These instructions apply to every agent working in this repository. Follow
them literally. They define the Spec-Driven Development workflow for
LibraryFlow. They are generic: each agent must use its own assigned identity,
owner, responsibilities, and task dependencies.

## Required agent-assisted workflow

- Every team member must run an AI coding agent on their own computer in their
  local LibraryFlow checkout for project work. The agent must read and
  acknowledge this starter, identify the assigned board task, and make the
  repository file changes itself using its tools. Do not copy agent-generated
  changes into the repository manually or work around this requirement.
- The human owner directs and reviews the work, provides approvals, handles
  provider-side settings and credentials when needed, and signs off evidence.
  Agent assistance does not replace the human's responsibility for security
  or deployment decisions.
- Record the owner, agent name, task ID, dates, changed files, verification
  evidence and commit in the task and session log. If an agent, checkout or
  dependency is unavailable, mark the task `Blocked`; do not work around the
  requirement or report it complete.
- This is a team process requirement, not technical enforcement: a document
  cannot detect whether an agent is running or prevent unassisted edits.

## 1. Agent identity and authority

- Before development, ask the owner to assign or confirm the agent's singular
  name and provide the owner's name.
- Do not assume another agent's name, owner, branch, responsibilities, or
  task. Never copy identity data from another agent's log.
- The agent is an AI assistant using Copilot SDK in VS Code with access to the
  real repository.
- Do not push to a remote repository without explicit owner authorization.
- Do not claim that a command, test, build, deployment, review, or acceptance
  scenario ran unless its output was actually observed.
- Ask the owner for clarification before acting when the task, scope, owner,
  dependency, contract, or expected result is ambiguous.
- Before implementation, report no more than five concise points covering the
  bounded task, owner, dependencies, affected files/routes, and verification.
  Wait for owner confirmation before generating code or running tests.
- After reading the applicable documentation, provide the owner a prioritized
  summary of the relevant activities, user stories, functionality,
  specifications, dependencies, and verification commands. Ask the owner to
  confirm they understand the work before implementation.

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
3. Confirm the owner-approved target branch and upstream. Update it only with
   owner authorization and fast-forward-only behavior when safe. Do not
   discard unrelated work or use destructive reset/checkout commands.
4. Read the relevant agent logs and documentation, then ask the owner to
   authorize the baseline commands. Verify the baseline with:

   ```text
   npm run typecheck
   npm run build
   npm test
   ```

5. If the baseline cannot compile or tests fail, stop implementation, record
   the failure in an agent log, report it to the owner, and wait for direction.
6. Confirm the required functionality exists before writing dependent code. If
   it does not exist, record a blocking issue and continue only with unrelated
   unblocked work.

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
not in the contract. If a new one is necessary, report the ambiguity and obtain
owner approval before updating the contract and acceptance register.

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

- Favorites are private, deterministic, and idempotent.
- Ratings are integers from 1 to 5, one per authenticated reader/book, with
  transactional summaries. Purchases and their rating gate are deferred.
- Server-side identity, ownership, applicable account restrictions and book
  availability must be enforced; a disabled or unverified restriction is a
  blocker, not proof it works.
- Applicable mutable records use stable IDs, revisions, and explicit conflicts.
- Feature UI handles loading, empty, signed-out, error/retry and relevant
  offline states, with keyboard access and responsive layouts.
- Collections, follows, update notifications, pricing and purchases are
  deferred. Only the current sprint's applicable contract sections are in
  scope; do not silently implement deferred requirements.

## 6. Task-board and dependency rules

Every implementation task must use a stable ID from
[SPRINT-002-003-TASK-BOARD.md](../sprints/SPRINT-002-003-TASK-BOARD.md), or the
owner must approve adding one before work starts. The task must be assigned to
the current agent and owner; do not perform another agent's task without an
explicit handoff.

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
by the persistence owner and require the integration owner designated in the
applicable sprint plan to approve changes before UI consumers change.

## 7. Verification and evidence

After every significant change:

1. Check the owner-approved branch and upstream without discarding changes.
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
   runs. A passing build alone does not demonstrate a functional feature.
   Record skipped/TODO tests, failed checks and missing live evidence as such.
   Keep the task `Blocked` or `In progress` if required checks cannot pass.

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
  <type>(<scope>) [<owner>]: <description>
  ```

- Before marking a task `Done`, the agent must create the final task commit
  itself. Its commit body must contain a complete, truthful summary with:
  task ID, owner and agent name; implemented behavior and affected files;
  verification commands/scenarios with actual results and environment;
  linked acceptance evidence; and any remaining limitations or follow-up.
  Do not include secrets or claim a test or deployment passed without
  observing it. Intermediate commits may be used, but a work-in-progress
  commit is not a completion claim.
- Mark the task `Done` only after the functional checks and required evidence
  pass and the final commit exists. If required work or verification is
  blocked, report the blocker rather than creating a success-shaped summary.
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

The project is not complete because documentation or code exists. Sprint 3
is complete only when its in-scope acceptance register contains dated evidence,
required deployment checks pass, no critical/high security issue remains,
outstanding Sprint 2 items have honest dispositions, and Carlos approves the
final demo and release evidence.

## 10. First-task readiness response

Before receiving a first implementation task, the agent may create or update
only a readiness log stating that it understands these instructions and is
ready to receive a bounded task. It must not modify implementation files or
run commands/tests merely because it has read this prompt.

When a bounded task is assigned, the agent must report:

1. Agent name and owner.
2. Task-board ID, sprint, and bounded objective.
3. Relevant user stories, specifications, contract sections, and dependencies.
4. Files/routes expected to change.
5. Exact verification commands or manual scenarios.

The owner must confirm that summary before implementation begins. If the owner
has not supplied a name, task, or confirmation, stop and ask for it.
