# SPEC-001: LibraryFlow — Sprint 1 First Viable Product

## 1. Purpose and status

This specification defines the approved technical and functional baseline for
LibraryFlow Sprint 1. It converts the Sprint 1 stories and clarified decisions
into implementable contracts without adding later-backlog functionality.

**Status:** Approved for Sprint 1 implementation planning  
**Baseline:** `SPEC-000-foundation.md`  
**Scope source:** `docs/sprints/SPRINT-001.md` and the linked user stories

The application must not implement collections, favorites, notifications as a
general product capability, ratings, following publishers, payments, credits,
account deletion, or moderation capabilities outside the selected book-approval
and comment-removal paths.

## 2. Sprint 1 goal and story scope

The first viable product must support this demonstrable flow:

1. A reader or publisher registers and logs in.
2. A publisher submits an EPUB or PDF book under 20 MB.
3. The system stores the book as pending approval and preserves ownership.
4. A seeded moderator approves or rejects the book.
5. Approved books appear in the public catalog and rejected books do not.
6. Readers and publishers search and filter the approved catalog.
7. Readers comment on approved books and publishers view their book comments.
8. Readers download an approved book and read its IndexedDB copy offline.
9. A publisher updates valid metadata for an owned book.
10. A moderator removes violating comments with an audit record and author
    notification.

### 2.1 Included stories

| Capability | Stories |
|---|---|
| Authentication and roles | `US-REA-010` |
| Publishing and book lifecycle | `US-PUB-001`, `US-MOD-006` |
| Catalog search | `US-REA-001`, `US-REA-011`, `US-PUB-002` |
| Metadata and classification | `US-PUB-004`, `US-PUB-005`, `US-MOD-001`, `US-MOD-002` |
| Comments and moderation | `US-REA-012`, `US-PUB-003`, `US-MOD-003` |
| Offline access | `US-REA-003` |
| Seeded test identity | `US-MOD-010` CA-001 only |

`US-MOD-010` is limited to the seeded moderator account required to test the
approval workflow. Seeded publisher/reader accounts and account-creation
administration are outside Sprint 1.

## 3. Actors and authorization

| Actor | Public catalog | Publish/manage own books | Comment | Classify | Approve/reject books | Remove comments |
|---|---:|---:|---:|---:|---:|---:|
| Unauthenticated visitor | Read approved content | No | No | No | No | No |
| Reader | Read approved content | No | Yes | No | No | No |
| Publisher | Read approved content | Yes | No publishing requirement beyond story rules | Own books | No | No |
| Moderator | Read approved content | As explicitly authorized | As explicitly authorized | Yes | Yes | Yes |

Authorization must be enforced in the service/API boundary, not only in the
frontend. Ownership checks compare the authenticated actor with the persisted
book owner. Deleted or rejected content is never exposed through public
catalog, detail, comment, or download queries.

## 4. Approved technology baseline

- Frontend: React, Vite, and TypeScript.
- Presentation: HTML5, CSS3, and Tailwind CSS loaded through the CDN for Sprint
  1.
- Backend: Node.js with a RESTful API.
- Cloud database: Firestore.
- Cloud bucket storage: Supabase.
- Local structured persistence and offline files: IndexedDB.
- Cloud authentication contract: Firebase-compatible authentication.
- Local authentication: mock service implementing the same registration, login,
  session, and role contract for offline development and testing.
- Version control: Git and focused Conventional Commits.

The React/Vite/TypeScript baseline supersedes the older native-ES-module-only
wording in `SPEC-000` for this sprint. JavaScript/TypeScript modules remain
required for code organization.

## 5. Domain model and invariants

### User

- `id` is unique.
- `email` is unique, standard-format, and no longer than 50 characters.
- Passwords are never stored in plain text.
- Roles are `reader`, `publisher`, or `moderator`.
- A first-time display name is the email local part plus a random four-digit
  suffix and must be unique.
- Local and cloud authentication expose the same session and role contract.

### Book

- `id`, `accessKey`, and shareable URL are unique.
- `ownerId` is immutable after creation.
- Title is required and no longer than 100 characters.
- The name/author combination is unique.
- Content is exactly one EPUB or PDF file no larger than 20 MB.
- Lifecycle states are `pending`, `approved`, or `rejected`.
- Only `approved` books are public, searchable, commentable, and downloadable.
- Rejected content is private until its scheduled bucket deletion.
- Metadata changes preserve book ID, owner, and publication history.

### Classification

- Categories and genres use persisted moderator-managed records.
- Names are unique and non-empty.
- Books reference existing classification IDs.
- Renaming a classification preserves associations.
- Classification changes are persisted and used by catalog filters.

### Comment

- A comment belongs to exactly one book and one author.
- Text is normalized before validation and storage.
- Comments are ordered by creation time descending, newest first.
- A deleted comment is excluded from normal reader and publisher views.
- Removal stores the comment ID, moderator ID, reason, and deletion time.

### Offline copy and download

- Supported content formats are EPUB and PDF.
- Download states are `Not Started`, `In Progress`, `Completed`, and `Failed`.
- Only a complete `Completed` copy is readable offline.
- The local copy stores enough metadata to preserve the published title and
  author.
- An IndexedDB quota error leaves no incomplete copy and provides an actionable
  notification.

## 6. Authentication and local-mode contract

The authentication service exposes:

- `register(email, password, requestedRole)`
- `login(email, password)`
- `logout()`
- `getCurrentSession()`
- `hasRole(role)`

The mock service is used in local development and tests. It persists users and
sessions in IndexedDB, applies the same validation and role checks as the cloud
adapter, and supports operation without network access. The seeded moderator
account is available in local and test environments and is marked as a
non-production test account.

The cloud adapter must preserve this contract while delegating credential
security to the configured Firebase-compatible provider.

## 7. Persistence, synchronization, and storage

IndexedDB is authoritative while the application is offline. It stores:

- users/sessions for the local mock service;
- book metadata and lifecycle state;
- categories, genres, and comments;
- in-app notifications required by the selected rejection/removal flows;
- offline book files and download state.

When online, changes synchronize with Firestore through the REST API boundary.
Synchronization must use stable IDs, timestamps, and explicit conflict
resolution rules. A conflict must not silently overwrite newer data; the
service must retain the winning state according to the approved timestamp and
revision policy and report the resolution to the caller.

Supabase stores book files in cloud mode. A rejected file is inaccessible to
public readers and is deleted 24 hours after rejection. The deletion operation
must be idempotent and safe to retry.

Malformed or missing IndexedDB records must be rejected with a recoverable
application error. Initialization must not throw an unhandled exception or
present invalid data as valid.

## 8. Book lifecycle and moderation

### Submission

1. Authenticate the publisher and validate all required metadata.
2. Validate EPUB/PDF type and a maximum size of 20 MB before bucket upload.
3. Generate unique book ID, access key, and shareable URL.
4. Persist owner, metadata, file reference, and `pending` state.
5. Do not expose the book in public queries.

### Approval

1. Confirm the actor is a moderator.
2. Set lifecycle state to `approved`.
3. Persist the decision and make the book available to public queries.

### Rejection

1. Confirm the actor is a moderator and a reason is supplied.
2. Set lifecycle state to `rejected`.
3. Create an in-app notification for the publisher immediately.
4. Schedule bucket deletion for 24 hours after rejection.
5. Keep the rejected file private until deletion.

The minimum moderator UI must support selecting pending books and confirming
approval or rejection. The seeded moderator account is used for the complete
local/test workflow.

## 9. Search, metadata, and comments

Search queries are case-insensitive and match title, author, or publisher.
Category and genre filters can be combined with text queries; every result must
satisfy every selected criterion. An empty query returns the approved public
catalog. No-match results show an explicit empty state and never include
unrelated books.

Publishers may edit metadata only for books they own, unless a moderator is
explicitly authorized. Required fields and approved limits are validated before
any mutation. A failed validation or authorization check leaves stored data
unchanged.

Authenticated readers may create comments on approved books. Unauthenticated
users are directed to authenticate. Moderators may remove comments after
confirmation. Removal hides the comment, records the audit fields, and creates
an in-app notification for the author.

## 10. Download and offline behavior

The reader can start a download only for an approved public book with available
content. The UI reports `In Progress`, then `Completed` on an atomic IndexedDB
write. Network failure, unavailable content, invalid content, or quota failure
reports `Failed`, removes any partial copy, and offers retry.

A completed EPUB/PDF copy can be opened without network access. Its displayed
title and author must match the published metadata. Offline copies are for the
reader's personal access and must not expose another user's private data.

## 11. API and error contract

REST endpoints must enforce authentication and authorization on the server
boundary. Responses use a consistent shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title is required.",
    "field": "title"
  }
}
```

Errors must identify the actionable cause without exposing passwords, private
files, or whether a login failure was caused by the email or password. Storage,
sync, quota, and scheduled-deletion failures must be surfaced explicitly and
must not return a success-shaped fallback.

## 12. Frontend routes and accessibility

The frontend must provide role-aware views for:

- authentication;
- public catalog and combined search/filter;
- approved book details, comments, and download;
- publisher-owned submission and metadata management;
- moderator pending-book approval/rejection;
- moderator category/genre management;
- moderator comment removal.

Forms require labels, keyboard access, visible validation messages, semantic
headings, and status announcements for authentication, upload, download, and
moderation notifications. Unauthorized routes must show an access-denied state
and must not expose protected data.

## 13. Testing and acceptance evidence

Each acceptance criterion in `SPRINT-001.md` requires a focused test or a
documented manual verification. At minimum, evidence must cover:

- valid and invalid authentication, role guards, seeded moderator access;
- file type and 20 MB boundaries;
- pending/approved/rejected visibility;
- immediate rejection notification and 24-hour deletion scheduling;
- ownership and identity preservation;
- case-insensitive combined search and empty states;
- valid/invalid classification references;
- newest-first comments and removal audit/notification;
- download progress, retry, quota failure, and offline reading;
- reload persistence and local/cloud synchronization behavior.

No verification may be reported as passed unless it was actually executed.

## 14. Definition of Done and exclusions

A Sprint 1 task is complete when its linked acceptance criteria, implementation,
focused verification, review, persistence behavior, authorization behavior,
local execution, and traceability evidence are complete. Changes must follow
`SPEC-000` naming and Git conventions and must not include unrelated or later
backlog work.

The following remain explicitly excluded: collections, favorites, general
notifications, ratings, following publishers, purchases, pricing, credits,
account deletion, social login, MFA, full moderation administration, automatic
content moderation, and cross-device annotation synchronization.
