# SPEC-002 Implementation Contract

This document is normative for Sprint 2 implementation. If an existing Sprint
1 implementation uses a different name, the shared `ApiResponse` shape and the
rules in this document take precedence. No agent may add a new public route or
state without updating this contract and the acceptance register.

## 1. Common API Contract

### 1.1 Transport

- API base path: `/api/v1`.
- JSON request and response bodies use UTF-8.
- Protected requests send `Authorization: Bearer <id-token>`.
- Firebase ID tokens are verified by the backend. The decoded UID is the only
  identity used for ownership checks.
- Local and test authentication must expose the same session and role
  contract. A local token must never be accepted by a deployed environment.
- Successful responses use:

```json
{ "success": true, "data": {} }
```

- Failed responses use:

```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Safe English message", "field": "optionalField" }
}
```

- `field` is present only for a field-specific validation error.
- Error messages never contain tokens, credentials, private storage URLs, or
  internal stack traces.

### 1.2 Required status codes

| Situation | Status | Error code |
|---|---:|---|
| Invalid JSON | 400 | `INVALID_JSON` |
| Invalid field | 400 | `VALIDATION_ERROR` |
| Missing authentication | 401 | `AUTH_REQUIRED` |
| Invalid or revoked token | 401 | `AUTH_INVALID` |
| Authenticated but wrong role | 403 | `FORBIDDEN` |
| Authenticated but banned/deletion-pending | 403 | `ACCOUNT_RESTRICTED` |
| Resource does not exist or is not visible | 404 | `NOT_FOUND` |
| Duplicate active record | 409 | `DUPLICATE_RESOURCE` |
| Meaningful revision conflict | 409 | `REVISION_CONFLICT` |
| Invalid state transition | 409 | `INVALID_STATE` |
| Unexpected server failure | 500 | `INTERNAL_ERROR` |

### 1.3 Authentication and roles

The only Sprint 2 roles are `reader`, `publisher`, and `moderator`. A public
registration request may create only `reader` or `publisher-applicant`
account state. It may never set the `publisher` role or upload permission.
Role claims are changed only by an authenticated administrator/moderator
operation on the server.

Every protected handler must perform all of these checks in order:

1. Verify the token.
2. Load the account by token UID.
3. Reject an account with `deletionRequestedAt` or an active ban.
4. Check the required role.
5. Check resource ownership and current resource state.

## 2. Publisher Application Contract

### 2.1 Data model

Collection: `publisherApplications/{applicationId}`.

```ts
type PublisherApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

type PublisherApplication = {
  id: string;
  applicantUid: string;
  publisherName: string;
  legalRepresentativeName: string;
  independentPublisher: boolean;
  publisherEmail: string;
  website?: string;
  status: PublisherApplicationStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  expiresAt: string;
  reviewerUid?: string;
  decisionReason?: string;
  revision: number;
};
```

`expired` is a terminal application status. It resolves the inconsistency
between US-REA-013 and the original status list. Expiration never grants
publisher privileges and leaves the account as `reader`.

Validation:

| Field | Rule |
|---|---|
| `publisherName` | required, trimmed, 1-100 characters |
| `legalRepresentativeName` | required, trimmed, 1-100 characters |
| `independentPublisher` | required boolean |
| `publisherEmail` | required valid email, maximum 50 characters |
| `website` | optional valid `https` URL, maximum 200 characters |
| `decisionReason` | required for rejection/revocation, 1-500 characters |

The default 25-character field rule does not override the explicit limits in
this table. All text is trimmed before validation and persistence.

### 2.2 State transitions

| Current | Action | Next | Actor | Side effects |
|---|---|---|---|---|
| none | submit | `pending` | authenticated reader | one application, `expiresAt = createdAt + 30 days` |
| `pending` | approve | `approved` | moderator/admin | transaction sets role claim to `publisher`, audit, notification |
| `pending` | reject | `rejected` | moderator/admin | reason, audit, notification; role remains `reader` |
| `pending` | withdraw | `withdrawn` | applicant | audit; role remains `reader` |
| `pending` | expire | `expired` | scheduled worker | audit, notification; role remains `reader` |

No terminal state may transition to another state. A reader may submit a new
application only after `rejected`, `withdrawn`, or `expired`. An account with
an `approved` application may not submit another application.

### 2.3 Routes

| Method | Route | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/publisher-applications` | reader | application fields | `201 PublisherApplication` |
| GET | `/publisher-applications/me` | reader | none | `200 PublisherApplication[]` |
| POST | `/publisher-applications/:id/withdraw` | applicant reader | `{ revision }` | `200 PublisherApplication` |
| GET | `/moderation/publisher-applications?status=pending` | moderator | query status | `200 PublisherApplication[]` |
| POST | `/moderation/publisher-applications/:id/approve` | moderator | `{ revision }` | `200 PublisherApplication` |
| POST | `/moderation/publisher-applications/:id/reject` | moderator | `{ revision, reason }` | `200 PublisherApplication` |
| POST | `/moderation/publishers/:uid/revoke` | moderator | `{ reason }` | `200 { uid, role: "reader" }` |

Duplicate active submission returns `409 DUPLICATE_RESOURCE`. Approval is one
Firestore transaction: it checks `pending` and `revision`, writes the
application, account role, audit record, and notification or writes none of
them. A failed transaction cannot partially grant a role.

## 3. Revision and Synchronization Contract

All mutable Sprint 2 records contain `revision`, starting at `1`. A mutation
must include the client-observed `revision`. The server transaction succeeds
only when the stored revision equals the supplied revision, then increments it
by one.

Conflict response:

```json
{
  "success": false,
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "The record changed. Reload it before retrying."
  },
  "data": {
    "resourceId": "id",
    "serverRevision": 4,
    "serverValue": {}
  }
}
```

The implementation must preserve the server value and must not silently apply
the client value. IndexedDB queues offline mutations with stable IDs. Replay is
idempotent by mutation ID. A successful replay removes the queue item; a
conflict remains visible to the user and is not retried indefinitely.

## 4. Books and Storage

Book status is `pending | approved | rejected | deleted`. Only `publisher`
may create or update an owned book. A `publisher-applicant`, `reader`, banned
account, revoked publisher, or deletion-pending account receives
`403 FORBIDDEN` or `403 ACCOUNT_RESTRICTED`.

Required book constraints:

- title: 1-100 characters;
- author/name: 1-100 characters;
- description: 1-2000 characters;
- file type: EPUB or PDF;
- file size: at most 20 MB;
- owner UID is taken from the token, never from request data;
- access key is generated server-side from normalized title and author plus a
  collision-safe suffix.

Supabase bucket `book-files` is private. Object key:
`books/{bookId}/{revision}/{sanitizedOriginalName}`. The browser never receives
a service-role key or a permanent public URL. Any temporary download URL is
generated server-side only for an authorized reader and expires within 10
minutes.

Book routes:

| Method | Route | Auth |
|---|---|---|
| POST | `/books` | publisher |
| PATCH | `/books/:id` | owner publisher or moderator |
| POST | `/moderation/books/:id/approve` | moderator |
| POST | `/moderation/books/:id/reject` | moderator |
| DELETE | `/moderation/books/:id` | moderator |

Rejection leaves the object private and creates one deletion job due 24 hours
after rejection. Permanent deletion marks the record `deleted`, removes all
metadata exposed to ordinary users, and creates an immediate cleanup job.

## 5. Deletion Jobs

Collection: `deletionJobs/{jobId}`.

```ts
type DeletionJob = {
  id: string;
  kind: "rejected-book-file" | "deleted-book-file" | "account-data";
  targetId: string;
  dueAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  claimedAt?: string;
  completedAt?: string;
};
```

Workers claim a `pending` or retryable `failed` job in a transaction by writing
`processing` and a claim timestamp. A completed job is never processed again.
Failures increment `attempts`, store a safe error, and schedule exponential
backoff. Jobs are not deleted from the database, so cleanup is auditable and
idempotent.

## 6. Account, Session, Ban, and Audit Contract

Account deletion:

- `POST /account/deletion-request` sets `deletionRequestedAt` and
  `permanentDeletionAt = now + 30 days`;
- personal public fields are removed immediately;
- login and token refresh return `403 ACCOUNT_RESTRICTED` during the grace
  period;
- `POST /account/deletion-cancel` is allowed only during the grace period;
- the scheduled worker permanently removes account-owned personal data after
  `permanentDeletionAt`;
- `POST /moderation/accounts/:uid/restore` is moderator-only and audited.

Session routes:

| Method | Route | Behavior |
|---|---|---|
| POST | `/auth/refresh` | returns a refreshed session through the auth adapter |
| POST | `/auth/logout` | revokes refresh/session tokens and clears local session |
| POST | `/account/deletion-request` | starts the deletion grace period |
| POST | `/account/deletion-cancel` | restores active account before deadline |

Ban records require `actorUid`, `targetUid`, `reason`, `startsAt`, and either
`endsAt` or `permanent: true`. Active bans block comments, uploads, moderation
targets, and authenticated restricted actions. Every ban, lift, revocation,
deletion, restore, and application decision writes an immutable audit record
with actor, target, reason, action, and timestamp.

## 7. Notifications

Collection: `notifications/{notificationId}` with a unique idempotency key
`{recipientUid}:{eventType}:{resourceId}:{resourceRevision}`.

Sprint 2 notification types:
`publisher_application_approved`, `publisher_application_rejected`,
`publisher_application_expired`, `publisher_revoked`, `book_rejected`,
`book_deleted`, `account_restored`, `ban_changed`.

Notifications are private to the recipient, created in the same transaction as
the decision where possible, and never contain private file URLs or another
user's data.

## 8. Environment and Deployment Contract

Required backend environment variables:

```text
NODE_ENV
PORT
FRONTEND_ORIGIN
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_BOOK_BUCKET
DELETION_WORKER_SECRET
```

Required frontend variables contain only public configuration:

```text
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
```

No service-role key, Firebase private key, worker secret, or database
credential may use a `VITE_` name or appear in source control.

`GET /health` returns the existing `HealthResponse`. It must be unauthenticated
and return HTTP 200 only when the process is ready to serve. CORS allows only
the configured `FRONTEND_ORIGIN` values, never `*` in production.

## 9. Sprint 2 Work Handoffs and Verification

| Owner | Deliverable | Handoff condition |
|---|---|---|
| Bryan | auth/session/account restriction | shared auth result and error codes |
| Juan | applications, repositories, revisions, DTOs | shared types and transaction tests |
| Karlo | reader application/status UX | consumes application DTOs only |
| Dante | application/admin review UX | consumes application DTOs only |
| Jorge | storage/jobs/deployment | environment matrix and health evidence |
| Cesar | acceptance/security suites | dated evidence mapped to S2-AC IDs |
| Carlos | integration/demo/sign-off | merged branch and complete evidence |

Required local verification before handoff:

```text
npm run typecheck
npm run build
npm test
```

Each owner must also provide focused tests for their contract and update the
matching row in `S2-ACCEPTANCE-REGISTER.md` only after execution.
