# Sprint 1 — Scrum + SDD

Act as a software senior architect, scrum  master and full-stack developer senior specialized in spec-driven development (sdd).

We are developing LibraryFlow, a web app for book sharing and discovery.

Once all specs are clear and approved, our objective is to formally begin with the Sprint 1.

## Technical content

- HTML5. 
- CSS3 and TailwindCSS through CDN, according to SPEC-000-foundation.md.
- JavaScript ES Modules.
- Only allowed frameworks.
- Test database/Firestore database.
- Persistance on localstorage/Firestore.
- Local execution from VSCode Through HTTP server/Deployment ready application with Netlify and render.
- Git version control.

## Sprint 1 stories

Sprint 1 includes the stories required to deliver the first viable product:
authentication, publishing, public discovery, metadata maintenance,
classification, discussion, moderation, and offline access.

### Core product stories

| Backlog capability | User story | Description |
|---|---|---|
| PB-001 | [US-REA-010](../user_stories/REA/US-REA-010-RegisterAndLogin.md) | Register and log in |
| PB-002 | [US-PUB-001](../user_stories/PUB/US-PUB-001-ShareBooks.md) | Publish and share books, including ownership and publication state |
| PB-003 | [US-REA-001](../user_stories/REA/US-REA-001-SearchWithFilters.md) | Search books with filters as a reader |
| PB-003 | [US-REA-011](../user_stories/REA/US-REA-011-SearchBooks.md) | Search books by category and genre |
| PB-003 | [US-PUB-002](../user_stories/PUB/US-PUB-002-SearchBooks.md) | Search public books as a publisher |
| PB-004 | [US-PUB-004](../user_stories/PUB/US-PUB-004-UpdateBookDetails.md) | Update owned book details and metadata |
| PB-005 | [US-PUB-005](../user_stories/PUB/US-PUB-005-ClassifyBooks.md) | Classify books by category and genre |
| PB-006 | [US-REA-012](../user_stories/REA/US-REA-012-CommentOnBooks.md) | Publish and display reader comments |
| PB-006 | [US-PUB-003](../user_stories/PUB/US-PUB-003-CommentSection.md) | View comments on published books |
| PB-007 | [US-REA-003](../user_stories/REA/US-REA-003-DownloadBooks.md) | Download and read books offline |

### Enabling stories

These stories are included only to provide the controlled values and minimum
visibility rules required by the core product stories:

| Enabling capability | User story | Sprint boundary |
|---|---|---|
| Classification values | [US-MOD-001](../user_stories/MOD/US-MOD-001-ManageCategories.md) | Provide category values; full moderation administration is limited to the required path |
| Classification values | [US-MOD-002](../user_stories/MOD/US-MOD-002-OrganizeGenres.md) | Provide genre values; full moderation administration is limited to the required path |
| Book approval state | [US-MOD-006](../user_stories/MOD/US-MOD-006-ApproveBooks.md) | Provide the minimum approval state required before a book is public |
| Comment moderation | [US-MOD-003](../user_stories/MOD/US-MOD-003-DeleteUserComments.md) | Provide the minimum removal and author-notification behavior required by the comment stories |
| Test identity | [US-MOD-010](../user_stories/MOD/US-MOD-010-SeededAccounts.md) | Provide the seeded moderator account required for the approval workflow; publisher/reader seeding and account creation remain outside this sprint |

The stories above replace the unresolved `US-001 TO US-008` placeholder. No
story is included from the later backlog capabilities for collections,
favorites, notifications, ratings, following publishers, payments, credits,
account deletion, or general user moderation beyond the selected comment and
book approval paths.

### Sprint 1 scope rules

- Only public, approved books are searchable, viewable, commentable, or
  downloadable.
- Authentication is required for publishing, commenting, and publisher-owned
  management actions.
- Categories and genres must come from the controlled values provided by the
  enabling stories.
- The sprint delivers the minimum vertical slice needed to demonstrate the
  product; it does not implement the complete moderator administration suite.
- Acceptance criteria, business rules, and dependencies in the linked stories
  remain authoritative and must not be changed without approval.

## Reference Documents

- SPEC-000-foundation.md
- The user stories linked above
- docs/product/product-backlog-init.md
- docs/user_stories/FIELD_RULES.md
## Instructions
1.- analyze the documentation.
2.- verify that the user stories and the acceptance criteria are coherent.
3.- Confirm dependencies and Technical restrictions.
4.- Identify if there are necessary pending decisions.
5.- Propose a structure for SPEC-001
6.- Prepare the traceability matrix HU -> CA -> SPEC.
7.- Define the technical tasks necessary to implement the stories.

Do not modify the validated requirements without previous authorization.

Do not generate any code yet.

The approved SPEC-001 structure is the implementation baseline.

I will only work with Sprint 1. Do not implement functionalities of the second
sprint or any later backlog capability.

---

## Sprint 1 Execution Record — 2026-10-18

### Record scope

The existing Sprint start content is preserved in this file.

## Sprint 1 SDD execution record

### 1. Documentation analysis

The Sprint 1 scope was compared with the product goal, MVP backlog, product
reach, `SPEC-000-foundation.md`, `FIELD_RULES.md`, and every linked core and
enabling user story.

The first viable product has one end-to-end path:

1. A reader or publisher registers and logs in.
2. An authenticated publisher submits a book and its metadata.
3. The book is persisted with an owner and an approval state.
4. An authorized moderator supplies classifications and approves the book.
5. Readers and publishers search the approved public catalog.
6. Readers view the book, comment, and download an offline copy.
7. Publishers update their own metadata and view comments on their books.

The scope is limited to the stories listed above. Collections, favorites,
notifications, ratings, following publishers, payments, credits, account
deletion, and general moderation beyond the selected comment and book approval paths remains
outside Sprint 1.

### 2. Story and acceptance-criteria coherence

| Area | Result | Finding |
|---|---|---|
| Authentication | Coherent after clarification | `US-REA-010` covers cloud-compatible authentication, offline mock authentication, reader/publisher/moderator roles, seeded moderator access, validation, and display-name generation. |
| Publishing | Coherent after clarification | `US-PUB-001` now submits EPUB/PDF files into pending approval, prevents premature public visibility, enforces 20 MB, and defines immediate rejection notification with deletion after 24 hours. |
| Search | Coherent after consolidation | Reader and publisher search stories describe the same public, case-insensitive, combined-query behavior. `SPEC-001` must define one shared query contract with role-specific access rules. |
| Metadata and classification | Coherent with dependency | `US-PUB-004` and `US-PUB-005` require ownership checks and persistent controlled values. Category/genre identity behavior when renamed or removed must be defined. |
| Comments | Coherent after clarification | Reader publishing, publisher viewing, and `US-MOD-003` removal now share book-scoped comments, newest-first ordering, audit data, and author notification. |
| Offline access | Coherent after clarification | `US-REA-003` defines EPUB/PDF storage in IndexedDB, progress states, quota failure handling, retry behavior, and offline reading. |
| Field validation | Resolved | The default 25-character rule and all Sprint 1 field exceptions are defined in SPEC-001. |

The affected acceptance criteria and business rules were updated to reflect the
clarified decisions. The findings above confirm their coherence and identify
the remaining field-limit note.

### 3. Dependencies and technical restrictions

#### Story dependency chain

```text
US-REA-010
  -> US-PUB-001
       -> US-MOD-006
       -> US-MOD-001 -> US-MOD-002 -> US-PUB-005
       -> US-PUB-004
       -> US-REA-001 / US-REA-011 / US-PUB-002
       -> US-REA-012 -> US-PUB-003
       -> US-MOD-003
       -> US-REA-003
```

The dependency chain is a functional ordering, not permission to implement
outside the selected scope. The canonical story links in this file supersede
inconsistent dependency references such as `US-PUB-006` where the selected
publishing story is `US-PUB-001`.

#### Technical restrictions confirmed

- The application must run locally from VS Code and be deployable to Netlify
  and Render.
- The cloud database boundary is Firestore.
- Cloud bucket storage is Supabase.
- Structured browser persistence and offline access use IndexedDB. The
  application may retain localStorage only for small compatibility/configuration
  values.
- A RESTful API is required for backend communication.
- The foundation requires HTML5, CSS3, Tailwind CSS through CDN for Sprint 1,
  Git, React, Vite, TypeScript, and Node.js.
- New files and symbols must follow the naming conventions in `SPEC-000`.
- Changes must be incremental, focused, and documented with actual verification
  results.

#### Clarified technical baseline

React, Vite, and TypeScript are the approved frontend baseline. The older
native-ES-module-only statement in `SPEC-000-foundation.md` is superseded for
Sprint 1. Tailwind CSS remains loaded through the CDN as required by the
foundation.

### 4. Clarified decisions

The following decisions were provided in the document and applied to the
affected user stories:

| ID | Decision |
|---|---|
| DEC-001 | Confirm that the story list in this document is the complete first-viable-product scope. | **Resolved:** Confirmed. |
| DEC-002 | Choose the frontend baseline and reconcile the foundation statements. | **Resolved:** React + Vite + TypeScript; the older native ES-module-only statement is superseded. |
| DEC-003 | Define local authentication behavior and its relationship to Firebase Authentication. | **Resolved:** A mock authentication service simulates the Firebase contract locally, including registration, login, roles, and offline operation. |
| DEC-004 | Define the authoritative local persistence adapter and synchronization boundary with Firestore. | **Resolved:** IndexedDB is authoritative for structured local data and offline files; synchronization with Firestore handles online consistency and conflicts. |
| DEC-005 | Confirm the minimum moderator workflow. | **Resolved:** Sprint 1 includes a moderator role, seeded moderator account, and basic approve/reject UI. |
| DEC-006 | Define file formats, upload validation, offline storage, quota behavior, and progress states. | **Resolved:** EPUB/PDF, maximum 20 MB, IndexedDB with quota management, and `Not Started`, `In Progress`, `Completed`, and `Failed` states. |
| DEC-007 | Approve field-specific lengths and validation rules. | **Resolved:** The default text maximum is 25 characters. Exceptions are email (50), password (8–128), title (100), author (100), comment (1000), rejection reason (500), and classification name (50). |
| DEC-008 | Define rejection notification behavior and bucket deletion timing. | **Resolved:** Immediate in-app notification; Supabase deletion 24 hours after rejection. |
| DEC-009 | Define comment ordering and moderator-removal behavior. | **Resolved:** Newest-first ordering; authorized removal hides the comment and sends an in-app notification to its author. |

All field-specific limits required for Sprint 1 are resolved. The approved
`SPEC-001` structure and this execution record authorize implementation within
the stated scope.

### 5. Approved `SPEC-001` structure

The following structure is approved and is recorded in `SPEC-001.md`. It
authorizes implementation within the stated Sprint 1 scope:

1. Purpose, Sprint 1 goal, and explicit in/out-of-scope capabilities.
2. Canonical story IDs, backlog mapping, and acceptance-criteria index.
3. Actors, roles, authentication states, and authorization matrix.
4. Domain entities and invariants: user, book, ownership, approval state,
   category, genre, comment, notification status, and offline copy.
5. REST API and module contracts, including validation and error shapes.
6. Persistence adapters for local mode, Firestore, and Supabase bucket storage.
7. Authentication, authorization, file-access, and data-protection rules.
8. Validation rules and approved field-specific limits.
9. Book lifecycle, approval/rejection, notification, and storage-deletion
   transitions.
10. Search and filter semantics, including public visibility and empty states.
11. Comment association, ordering, visibility, and moderation behavior.
12. Download, retry, offline-read, quota, and supported-format behavior.
13. Frontend routes, role-aware states, accessibility, and responsive behavior.
14. Test strategy, acceptance evidence, traceability, and regression checks.
15. Local execution, environment configuration, deployment boundaries, and
    security checks.
16. Definition of Done, approved decisions, and explicit future-sprint
    exclusions.

### 6. Traceability matrix: story -> acceptance criteria -> SPEC-001

| Story | Acceptance criteria | Proposed `SPEC-001` sections | Verification evidence |
|---|---|---|---|
| `US-REA-010` | CA-001–CA-004, CA-006–CA-007 | 2, 3, 5, 7, 8 | Registration/login tests, duplicate/invalid input tests, authorization and role checks, display-name, and offline mock-auth tests |
| `US-PUB-001` | CA-001–CA-008 | 2, 3, 4, 5, 6, 7, 9 | EPUB/PDF submission, required-field, ownership, approval, 20 MB boundary, rejection notification, and deletion-schedule tests |
| `US-REA-001` | CA-001–CA-004 | 2, 5, 10 | Case-insensitive combined search/filter tests and empty-state test |
| `US-REA-011` | CA-001–CA-004 | 2, 5, 10 | Category/genre filter tests and public-catalog visibility test |
| `US-PUB-002` | CA-001–CA-004 | 2, 3, 5, 10 | Publisher public-search and no-match tests |
| `US-PUB-004` | CA-001–CA-003 | 3, 4, 5, 8 | Ownership rejection, valid update, identity preservation, and reload tests |
| `US-PUB-005` | CA-001–CA-004 | 3, 4, 5, 8, 10 | Valid/invalid classification, replacement, persistence, and discovery tests |
| `US-REA-012` | CA-001–CA-005 | 3, 4, 5, 8, 11 | Authenticated comment, whitespace rejection, unauthenticated redirect, newest-first display, and removal-notification tests |
| `US-PUB-003` | CA-001–CA-004 | 3, 4, 5, 11 | Book-scoped comments, author/time, empty state, and removal visibility tests |
| `US-REA-003` | CA-001–CA-004 | 4, 6, 7, 12 | Successful download, offline read, failure/retry, and identity-preservation checks |
| `US-MOD-001` | CA-001–CA-003 | 3, 4, 5, 8 | Authorized category create/update/duplicate tests |
| `US-MOD-002` | CA-001–CA-003 | 3, 4, 5, 8 | Authorized genre create/update/duplicate tests |
| `US-MOD-006` | CA-001–CA-002 | 3, 4, 5, 6, 7, 9 | Approval/rejection state, notification, and bucket-deletion tests |
| `US-MOD-003` | CA-001–CA-004 | 3, 4, 5, 7, 11 | Authorized removal, confirmation, audit record, notification, and unauthorized-access tests |
| `US-MOD-010` | CA-001 only | 2, 3, 7 | Seeded moderator login, role, and permission test |

### 7. Technical task plan

Each task must be labeled and assigned in Microsoft Planner. Agents may assist
with implementation, but the assigned worker owns the result and verification.

| Task | Owner | Dependency | Deliverable |
|---|---|---|---|
| S1-DOC-01 Approve scope and `SPEC-001` structure | Carlos | None | Decision record and approved specification outline |
| S1-DOC-02 Convert acceptance criteria into test cases | Cesar | S1-DOC-01 | Acceptance test register and evidence template |
| S1-ARCH-01 Define entities, states, API contracts, and error shapes | Carlos / Juan | S1-DOC-01 | Approved domain and integration contracts |
| S1-AUTH-01 Define and implement authentication boundary | Bryan | DEC-002, DEC-003, S1-ARCH-01 | Registration, login, password handling, roles, and guards |
| S1-DATA-01 Implement book metadata, ownership, and lifecycle boundary | Juan | DEC-004, S1-ARCH-01 | Book persistence, approval state, and storage contract |
| S1-DATA-02 Implement categories, genres, comments, and notifications | Juan | S1-DATA-01 | Controlled values, book-scoped comments, audit data, and in-app notification persistence |
| S1-MOD-01 Implement minimum approval, classification, and comment-moderation paths | Jorge / Juan | DEC-005, S1-DATA-01, S1-DATA-02 | Seeded moderator, authorized approval/removal, controlled values, and 24-hour deletion scheduling |
| S1-FE-01 Implement authentication and publisher workflows | Dante | S1-AUTH-01, S1-DATA-01, DEC-002 | Auth, publish, update, classify, and publisher comment views |
| S1-FE-02 Implement reader catalog and offline workflow | Karlo | S1-DATA-01, S1-DATA-02, DEC-006 | Search, filters, details, comments, download progress, quota errors, and offline read UI |
| S1-QA-01 Execute acceptance and regression verification | Cesar | S1-FE-01, S1-FE-02, S1-MOD-01 | Test results, defects, retests, and traceability updates |
| S1-PLAT-01 Validate local/deployment configuration and security | Jorge | DEC-002, DEC-003, DEC-004 | Reproducible local run, environment checks, and security findings |
| S1-INT-01 Integrate and conduct Sprint 1 demo | Carlos | S1-QA-01, S1-PLAT-01 | Integrated increment and product-owner acceptance |

### 8. Execution gate

This analysis, approved structure, matrix, and task plan are complete for the
planning phase. The readiness gate is satisfied because:

- the Sprint 1 story scope is approved;
- the `SPEC-001` structure and implementation contracts are approved;
- decisions `DEC-001` through `DEC-009` are resolved; and
- the acceptance register is available at
  `docs/testing/S1-ACCEPTANCE-REGISTER.md`.

The team may begin implementation tasks. It must not implement later backlog
capabilities or mark acceptance criteria as passed without executed evidence.

### 9. Approval and continuation record

The product owner approved the clarified Sprint 1 scope, decisions, and
approved `SPEC-001` structure after the affected user stories were updated.
The approved specification is now recorded in
[`docs/specs/SPEC-001.md`](../specs/SPEC-001.md).

Application implementation has not started. The next permitted phase is
agent-assisted implementation of the labeled technical tasks in this document,
using the approved specification and acceptance evidence requirements.