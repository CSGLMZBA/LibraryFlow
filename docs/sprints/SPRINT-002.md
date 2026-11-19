# Sprint 2 - Production Readiness and Approved Publishers

## Goal

Convert the Sprint 1 MVP into a deployable, cloud-backed platform where users
receive publisher status only after administrator approval.

## Sprint 2 Definition of Done

- Public registration never grants `publisher`.
- Readers can submit one active publisher application.
- Administrators approve or reject applications.
- Approval atomically adds publisher privileges.
- Rejection and withdrawal preserve reader status.
- Firebase, Firestore, Supabase, Render, and Netlify operate together.
- Cloud synchronization reports conflicts instead of silently overwriting.
- Rejection and deletion cleanup is persisted and idempotent.
- Temporary/permanent bans, publisher removal, account deletion, and audit
  records are implemented.
- The browser and API evidence pass a clean-clone and deployed verification.

## Scope

| Area | Stories | Deliverable |
|---|---|---|
| Publisher applications | US-REA-013, US-MOD-005, US-MOD-007 | Pending application, administrator review, role grant/revoke |
| Cloud identity | US-REA-010, US-REA-019, US-REA-020 | Firebase token verification, refresh/revoke behavior, logout |
| Account lifecycle | US-REA-017 | 30-day deletion request and restriction |
| Cloud data | US-PUB-001, US-PUB-004, US-MOD-006 | Stable Firestore persistence and revision conflict handling |
| Storage cleanup | US-PUB-001, US-MOD-006, US-MOD-008 | Private Supabase files and 24-hour deletion jobs |
| Platform moderation | US-MOD-004, US-MOD-007, US-MOD-008, US-MOD-011 | Bans, publisher revocation, book deletion, account restoration |
| Deployment | Sprint platform stories | Netlify, Render, health, CORS, secrets, backup, and rollback |

## Team Responsibilities

| Owner | Independent deliverable | Small collaboration | Minimum integration dependency |
|---|---|---|---|
| Carlos Gabriel Martinez Bazaldua | Sprint spec, integration branch, demo script, final acceptance | Reviews all PRs with Cesar and Jorge | Every owner |
| Bryan Alessandro Peralta Gutierrez | Firebase session lifecycle, token refresh/revoke, logout guard | Use shared auth contract with Dante; coordinate claims with Juan | Juan for role claims |
| Juan Carlos Zuniga Alfaro | Publisher application entities, Firestore repositories, conflict/revision rules | Share DTOs with Dante and Bryan | Carlos for merge; Jorge for scheduled operations |
| Karlo Silvestre de la Cruz Flores | Reader account UI, application status/withdrawal, offline reload UX | Align API labels with Juan; no publisher implementation dependency | Juan for application API |
| Dante Uriel Juarez Tolentino | Publisher application form and admin review UI | Use Carlos's routes and Juan's DTOs | Juan for API contract |
| Cesar Cutberto Hortelano Jimenez | Publisher/application/security acceptance suites and traceability | Coordinate defect evidence with all implementers | Carlos for final evidence |
| Jorge Enriquez Rico | Supabase storage, scheduled deletion, CORS, environment, health, backup | Coordinate storage lifecycle with Juan; deployment with Carlos | Juan for jobs; Carlos for live credentials |

## Suggested Independent Work Packages

### Sprint 2A - Security and Applications

1. Bryan: complete Firebase refresh/revoke/logout behavior.
2. Juan: implement publisher application records and atomic approval/rejection.
3. Dante: implement applicant and administrator screens.
4. Karlo: implement reader application status and withdrawal UI.
5. Cesar: define Sprint 2 acceptance cases and defects.
6. Jorge: finalize storage/CORS/deployment configuration.

### Sprint 2B - Cloud and Operations

1. Juan: add Firestore repositories and explicit revision conflicts.
2. Bryan: ensure every protected route verifies UID and custom claim.
3. Jorge: add idempotent deletion-job worker and deployment health checks.
4. Carlos: integrate branches, resolve DTO conflicts, run demo.
5. Cesar: execute suites and record passed/failed evidence.

## Collaboration Rules

- Shared contracts are agreed by Juan and approved by Carlos before UI coding.
- Bryan owns server identity; Dante owns only presentation and context.
- Juan owns persistence; Karlo and Dante consume DTOs but do not duplicate
  repository logic.
- Jorge owns deployment and infrastructure; each feature owner supplies only
  its environment variables and health requirements.
- Cesar tests public behavior rather than implementation details.
- Carlos resolves merge conflicts and owns only integration, demo, and release
  evidence—not the entire feature implementation.

## Main Dependencies

```text
SPEC-002 + Sprint 2 stories
        |
        +--> Bryan auth claims
        +--> Juan application/persistence/sync
                    |
                    +--> Dante admin/application UI
                    +--> Karlo reader status UI
                    +--> Jorge storage/jobs
        |
        +--> Cesar acceptance evidence
        +--> Carlos integration/demo
```

## Acceptance Evidence

Create:

- `docs/testing/S2-ACCEPTANCE-REGISTER.md`
- focused files under `docs/testing/`
- a deployed demo log in `docs/agent-logs/`

No item is passed until the test or manual scenario is executed and dated.
