# Sprint 1 Team Workflow and Execution Plan

**Product:** LibraryFlow  
**Sprint:** 1  
**Team size:** 7 workers, including the product owner/technical lead  
**Working model:** Scrum with specification-driven development (SDD) and agent-assisted implementation  
**Status:** Execution-ready; implementation may begin against approved `SPEC-001`

## 1. Purpose and operating principles

This document defines how the seven-person team will plan, implement, review, and
integrate the first sprint. Every team member uses an agent as an implementation
assistant, but the assigned team member remains accountable for the resulting
specification, code, tests, and review response.

The team will:

1. Implement only the approved Sprint 1 scope.
2. Treat the user stories and acceptance criteria as the source of functional truth.
3. Use `SPEC-000-foundation.md` as the technical baseline.
4. Require a traceable task, acceptance criterion, and verification step for every change.
5. Keep changes small, reviewable, and integrated through Git.
6. Never allow an agent to merge its own work without human review.
7. Escalate ambiguity instead of silently inventing behavior.

The repository states that validated requirements must not be modified without
authorization. `SPEC-001` is now approved for implementation; any new
behavioral decision requires a specification change before coding.

## 2. Sprint 1 scope baseline

The current backlog identifies seven essential MVP capabilities:

| Scope ID | MVP capability | Primary story evidence |
|---|---|---|
| PB-001 | Register and log in | `US-REA-010` |
| PB-002 | Publish and share books | `US-PUB-001` |
| PB-003 | View and search books | `US-REA-001`, `US-REA-011`, `US-PUB-002` |
| PB-004 | Maintain book details and metadata | `US-PUB-004` |
| PB-005 | Classify books by category and genre | `US-PUB-005` |
| PB-006 | Comment on books and moderation removal | `US-REA-012`, `US-PUB-003`, `US-MOD-003` |
| PB-007 | Download and read books offline | `US-REA-003` |

The canonical Sprint 1 story list is defined in
[`SPRINT-001.md`](SPRINT-001.md). It replaces the former unresolved
`US-001 TO US-008` placeholder with role-prefixed stories from the repository.
The sprint goal is to deliver a demonstrable vertical slice of authentication,
book publishing/moderation visibility, discovery, classification, discussion,
and offline access.

## 3. Team and ownership

Each worker owns a workstream and uses an agent with a bounded prompt. Ownership
does not prevent collaboration; it identifies the person responsible for
acceptance-criterion coverage and the final pull request.

| Worker | Role | Agent-assisted responsibility | Sprint deliverable |
|---|---|---|---|
| Carlos Gabriel Martinez Bazaldua (product owner) | Product owner, technical lead, integrator | Maintains scope, approves `SPEC-001`, coordinates agent prompts, resolves conflicts, reviews all PRs | Approved scope/specification, integrated sprint increment, final demo |
| BRYAN ALESSANDRO PERALTA GUTIERREZ | Backend/authentication engineer | Designs and implements authentication contracts and authorization guards | PB-001 and shared auth contract |
| JUAN CARLOS ZUÑIGA ALFARO | Backend/data and storage engineer | Implements book, metadata, classification, comment, and offline-storage data contracts | Persistence/storage layer and API boundaries for PB-002–PB-007 |
| KARLO SILVESTRE DE LA CRUZ FLORES | Frontend-oriented engineer | Builds reader catalog, search/filter, book detail, and offline reading experience | PB-003 and PB-007 reader UI |
| DANTE URIEL JUAREZ TOLENTINO | Frontend-oriented engineer | Builds authentication, publisher book forms, metadata/classification screens, and comment views | PB-001, PB-002, PB-004–PB-006 UI |
| CESAR CUTBERTO HORTELANO JIMENEZ | QA and SDD engineer | Converts acceptance criteria into test cases, performs exploratory/regression testing, checks traceability | Acceptance-criteria test evidence and release checklist |
| JORGE ENRIQUEZ RICO | Platform, security, and delivery engineer | Defines local/deployment configuration, security checks, environment boundaries, and integration support | Reproducible local run, deployment readiness, security review notes |

The product owner is also a worker and must reserve capacity for integration and
review instead of taking a feature slice that would make integration dependent
on one person.

## 4. Agent workflow for every work item

Every work item follows this sequence:

1. **Prepare:** The owner links the task to a scope ID, story, acceptance
   criteria, and approved specification section.
2. **Prompt:** The owner gives the agent only the bounded objective, relevant
   files, technical restrictions, expected output, and verification command.
3. **Inspect:** The agent reads existing patterns before editing and reports
   assumptions or contradictions.
4. **Implement:** The owner reviews the diff while the agent works. The agent
   does not broaden scope or change validated requirements.
5. **Verify:** The owner runs the smallest relevant test, lint, type check, or
   manual acceptance test and records the result.
6. **Review:** A second team member reviews the diff against the acceptance
   criteria and checks for regressions.
7. **Integrate:** The owner opens a focused pull request, resolves feedback,
   and merges only after required checks pass.
8. **Trace:** The task is marked complete only when the story, acceptance
   criteria, specification, code, and verification evidence are linked.

### Standard agent prompt contract

Each worker should adapt the following prompt rather than asking an agent to
“build the feature” broadly:

> You own `<task ID>` for `<story ID>`. Read `<files>` first. Implement only
> `<bounded behavior>` under `SPEC-000` and the approved `SPEC-001` section.
> Preserve existing behavior and do not implement Sprint 2 features. Report
> assumptions before editing. Update or add focused tests for `<acceptance
> criteria>`, run `<verification command>`, and summarize changed files,
> evidence, and unresolved risks.

## 5. Work breakdown and dependencies

Tasks are labeled with `S1-` and must be represented in Microsoft Planner with
the listed owner, labels, dependency, and acceptance evidence.

| Task | Owner | Depends on | Output |
|---|---|---|---|
| S1-DOC-01 Approve scope and `SPEC-001` outline | Carlos | None | Complete; approved story mapping, technical decisions, and specification outline |
| S1-DOC-02 Build acceptance-criteria test register | Cesar | S1-DOC-01 | Ready; test cases for every in-scope acceptance criterion |
| S1-ARCH-01 Define domain and API contracts | Carlos, Juan, Bryan | S1-DOC-01 | Auth, book, classification, comment, and storage contracts |
| S1-AUTH-01 Implement registration and login | Bryan | S1-ARCH-01 | PB-001 behavior, validation, secure credential handling, authorization boundary |
| S1-DATA-01 Implement book and metadata persistence | Juan | S1-ARCH-01 | Book identity, ownership, metadata, publication state, and storage boundary |
| S1-DATA-02 Implement classification and comment persistence contracts | Juan | S1-DATA-01 | Category/genre references and book-scoped comments |
| S1-FE-01 Implement authentication and publisher workflows | Dante | S1-AUTH-01, S1-DATA-01 | Registration/login, publish, edit, classify, and publisher comment views |
| S1-FE-02 Implement catalog, search, details, and offline reader | Karlo | S1-DATA-01, S1-DATA-02 | Reader discovery, filters, details, download, and offline access |
| S1-QA-01 Run feature and regression verification | Cesar | S1-AUTH-01, S1-DATA-02, S1-FE-01, S1-FE-02 | Test evidence, defect list, and retest results |
| S1-PLAT-01 Validate local/deployment configuration and security boundaries | Jorge | S1-ARCH-01 | Local run instructions, configuration checks, and security findings |
| S1-INT-01 Integrate, demo, and close sprint | Carlos | S1-QA-01, S1-PLAT-01 | Integrated increment, review record, and accepted/rejected criteria |

Parallel work is allowed after its dependency is complete. In particular,
Jorge can validate the environment while the UI work proceeds, and Cesar can
prepare test cases while implementation is underway. No dependent task is
considered ready based only on a verbal promise.

## 6. Traceability matrix

The matrix records the current mapping; it is not authorization to change the
underlying stories.

| Scope | Acceptance criteria covered | `SPEC-001` section to approve | Implementation owner(s) | Verification |
|---|---|---|---|---|
| PB-001 / `US-REA-010` | CA-001–CA-004, CA-006 | Authentication, authorization, validation, display-name generation | Bryan, Dante | Auth tests and manual invalid-credential checks |
| PB-002 / `US-PUB-001` | CA-001–CA-008 | Book lifecycle, ownership, moderation state, EPUB/PDF and 20 MB boundaries, rejection lifecycle | Juan, Dante | Publish/update/ownership tests, upload-limit, notification, and deletion-schedule checks |
| PB-003 / `US-REA-001`, `US-REA-011`, `US-PUB-002` | CA-001–CA-004 in each search story | Catalog query and filter semantics | Juan, Karlo | Case-insensitive combined-query tests and empty state |
| PB-004 / `US-PUB-004` | CA-001–CA-003 | Metadata update and authorization rules | Juan, Dante | Ownership, persistence, identity-preservation tests |
| PB-005 / `US-PUB-005` | CA-001–CA-004 | Controlled classification references | Juan, Dante, Karlo | Valid/invalid classification and filter integration tests |
| PB-006 / `US-REA-012`, `US-PUB-003`, `US-MOD-003` | Reader CA-001–CA-005, publisher CA-001–CA-004, moderator CA-001–CA-004 | Book-scoped comments, newest-first ordering, audit, notification, and moderation visibility | Juan, Dante, Jorge | Comment association, author/time, ordering, empty state, removal, audit, and notification tests |
| PB-007 / `US-REA-003` | CA-001–CA-004 | Download state, retry safety, local offline representation | Juan, Karlo | Download failure/retry and offline read checks |

## 7. Coherence and dependency findings

The following decisions are resolved and are now implementation constraints:

1. **Story identifiers:** The sprint now uses the canonical role-prefixed
   identifiers listed in `SPRINT-001.md`.
2. **Duplicate capabilities:** Search, download, and sharing appear in multiple
   role-specific stories. The specification must define one shared domain
   behavior with role-specific permissions rather than duplicate implementations.
3. **Dependency IDs:** The canonical dependencies are the `S1-` task
   dependencies in Section 5 and the role-prefixed story IDs in
   `SPRINT-001.md`. Historical references to `US-PUB-006` are not used for
   Sprint 1 planning.
4. **Authentication provider boundary:** Local development uses a mock service
   compatible with the Firebase contract; cloud authentication remains the
   production boundary.
5. **Moderation boundary:** Sprint 1 includes a seeded moderator and minimum
   approve/reject and comment-removal flows only.
6. **Persistence boundary:** IndexedDB is authoritative offline and synchronizes
   with Firestore online; invalid stored data must be safely rejected.
7. **File and offline limits:** EPUB/PDF, 20 MB maximum, IndexedDB quota
   management, and four explicit download states are now defined.
8. **Field limits:** Default and exception limits are defined in Section 15 of
   `SPEC-001`.

## 8. Proposed `SPEC-001` structure

The following `SPEC-001` structure is approved and is the implementation
baseline:

1. **Purpose and Sprint 1 scope**
2. **Canonical story IDs and scope mapping**
3. **Actors, roles, and authorization matrix**
4. **Domain entities and invariants**
   - User and display name
   - Book, ownership, publication/moderation state
   - Category and genre
   - Comment
   - Offline book copy
5. **API and module contracts**
6. **Persistence and storage adapters**
   - Local mode
   - Firebase/Firestore
   - Supabase bucket boundary
   - Invalid-data recovery
7. **Authentication and security rules**
8. **Validation and error-message rules**
9. **Search and filter semantics**
10. **Upload, download, and offline behavior**
11. **Frontend routes and accessibility requirements**
12. **Testing and acceptance-evidence plan**
13. **Local execution and deployment configuration**
14. **Definition of Done and traceability requirements**
15. **Approved implementation decisions and out-of-scope behavior**

## 9. Review and communication cadence

- **Daily:** Each worker posts progress, agent output, verification status, and
  blockers in the team channel and updates Microsoft Planner.
- **Before starting a task:** Confirm its dependency and link the relevant story
  and acceptance criteria.
- **Thursday review:** Demo completed vertical slices, review acceptance evidence,
  inspect open risks, and re-plan only with product-owner approval.
- **Before integration:** Run focused checks and obtain one reviewer outside the
  implementing workstream.
- **Sprint close:** Carlos verifies the traceability matrix, Cesar verifies
  acceptance evidence, and Jorge verifies reproducible local execution.

The project requirements specify December 3 as the delivery deadline and no
changes after December 2. The team must therefore freeze the Sprint 1 scope and
reserve the final review window before that cutoff.

## 10. Definition of Done for Sprint 1

A work item is done only when:

- its scope ID, story, and acceptance criteria are linked;
- the approved specification section exists;
- implementation is reviewed and uses the foundation conventions;
- validation and error paths are covered;
- focused tests or documented manual checks pass;
- persistence survives reload where required;
- unauthorized access and invalid input are rejected;
- local execution is reproducible;
- no Sprint 2 feature was added;
- the change is integrated through a focused Git commit/pull request; and
- the traceability matrix and Planner task are updated.

Sprint 1 is complete only when the integrated increment passes the agreed
acceptance tests and the product owner accepts the demo.

The acceptance-criteria register is maintained in
[`S1-ACCEPTANCE-REGISTER.md`](../testing/S1-ACCEPTANCE-REGISTER.md). A row may
be marked passed only with an executed test or a dated manual verification
record.

## 11. Execution record

### Completed during planning

- Reviewed the product goal, backlog, reach, foundation specification, sprint
  instructions, field rules, and the relevant role-specific stories.
- Replaced the unresolved `US-001`–`US-008` reference with the canonical
  first-viable-product stories and their enabling stories.
- Assigned all seven workers and defined two frontend-oriented workstreams.
- Defined dependencies, traceability, verification, review cadence, and the
  approved `SPEC-001` structure.

### Planning boundary

- No application feature code was generated during planning.
- No Sprint 2 functionality was implemented.
- No validated requirement was modified.
- Feature tasks are now authorized against the approved `SPEC-001` and the
  acceptance register; later-sprint functionality remains prohibited.
