# SPEC-002 - LibraryFlow Sprint 2

## 1. Purpose

Sprint 2 converts LibraryFlow's proven MVP into a production-ready platform
with administrator-controlled publisher access, cloud persistence, storage,
scheduling, secure sessions, and operational deployment.

## 2. Publisher Access Control

Public registration:

- creates only `reader` or `publisher-applicant` records;
- never grants the `publisher` role directly;
- must not expose an upload or file-storage capability.

`publisher-applicant` may:

- submit one active publisher application;
- view its application status;
- withdraw a pending application.

An administrator may:

- approve or reject an application;
- add a reason to every rejection;
- atomically change approved applicants to `publisher`;
- revoke publisher status without public role escalation.

The backend must enforce role and application state. Frontend controls are not
authorization.

## 3. Application Domain

Publisher applications include:

- stable application ID;
- applicant UID;
- organization/publisher name;
- legal representative name;
- independent-publisher status;
- public publisher email;
- optional website;
- status: `pending`, `approved`, `rejected`, or `withdrawn`;
- created, updated, reviewed, and expiration timestamps;
- reviewer UID and reason.

## 4. Cloud Persistence

- Firestore is authoritative in cloud mode.
- IndexedDB remains available offline.
- Stable IDs and revision numbers are required.
- Last-writer wins is prohibited when conflicting changes are meaningful.
- A conflict must return an explicit resolution result and preserve both values
  or the explicit revision winner.
- Book, application, comment, favorite, notification, and moderation records
  must synchronize without silent identity changes.

## 5. Storage and Scheduled Jobs

- Supabase stores approved and pending book files privately.
- Rejected and deleted files remain inaccessible publicly.
- A persisted deletion job schedules removal 24 hours after rejection.
- Workers claim jobs by ID and state to make retries idempotent.
- Failed jobs retain retry count, error, and next retry time.
- No background operation may expose file URLs or credentials to frontend code.

## 6. Authentication and Session Lifecycle

- Firebase ID tokens are verified server-side.
- Refresh tokens are revoked on logout or administrator termination.
- Sessions expire according to platform policy.
- Account deletion uses a 30-day grace period.
- During the grace period the account may not authenticate.
- Personal public fields are removed at deletion request time.

## 7. Moderation and Audit

Sprint 2 includes:

- comment removal audit;
- temporary and permanent user bans;
- publisher removal;
- pending publisher applications;
- book deletion and bucket cleanup;
- moderator audit history.

All moderation operations require server-side administrator/moderator roles and
store actor, target, reason, and timestamp.

## 8. Deployment

The platform must be deployable on:

- Netlify for the React frontend;
- Render for the Node.js API;
- Firebase for authentication and custom claims;
- Firestore for cloud records;
- Supabase for private file storage.

Every secret belongs in the platform environment, never in source or `VITE_*`
variables.

## 9. Acceptance

Sprint 2 is complete only when the acceptance suite and manual evidence confirm:

- no public registration grants publisher upload access;
- one pending application per reader;
- approval atomically grants publisher role;
- rejection and withdrawal preserve reader status;
- cloud and local flows survive reload;
- conflict results are explicit;
- protected routes reject unauthorized users;
- scheduled deletion is idempotent;
- Netlify and Render communicate through configured CORS;
- deployment health, logs, backup, and rollback evidence exist.

## 10. Normative Implementation Contract

The detailed Sprint 2 implementation contract is in
[SPEC-002-CONTRACTS.md](./SPEC-002-CONTRACTS.md). It defines the API envelope,
status codes, DTOs, validation limits, state transitions, revision/conflict
behavior, storage paths, deletion jobs, authentication lifecycle,
notifications, environment variables, ownership handoffs, and verification
commands. That contract is part of SPEC-002 and must be updated before any
agent introduces a new route, state, or persistence shape.
