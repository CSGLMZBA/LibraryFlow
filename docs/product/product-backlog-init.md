# LibraryFlow Product Backlog

Approved product roadmap for LibraryFlow.

> [!IMPORTANT]
> The status of `publisher` is restricted. Public registration creates a
> `reader` or, if explicitly requested and approved by an administrator,
> begins a pending `publisher` application. No user may upload books merely
> by selecting a publisher role.

## Backlog overview

| Priority | Items |
|---|---:|
| Sprint 1 — functional MVP | PB-001 to PB-009 |
| Sprint 2 — production readiness and access control | PB-017 to PB-022 |
| Sprint 3 — complete platform | PB-010 to PB-016 |

## MVP backlog

These items are considered essential for the first usable version of the product.

| ID | Capability | Priority | Related users | Value |
|---|---|---|---|---|
| PB-001 | Register and log in with reader, publisher, and moderator roles | Essential for the first viable product | Readers, Publishers, Moderators | Provides secure access and role-aware product workflows. |
| PB-002 | Submit, publish, and share books | Essential for the first viable product | Publishers, Readers | Allows publishers to submit EPUB/PDF books and lets readers access approved content. |
| PB-003 | View and search the approved catalog | Essential for the first viable product | Readers, Publishers | Helps users discover approved books with text and category/genre filters. |
| PB-004 | Maintain book details and metadata | Essential for the first viable product | Publishers | Keeps owned-book information accurate while preserving identity and ownership. |
| PB-005 | Classify books by category and genre | Essential for the first viable product | Publishers, Moderators | Keeps the approved catalog organized and improves discovery. |
| PB-006 | Comment on books and moderate violating comments | Essential for the first viable product | Readers, Publishers, Moderators | Enables discussion with newest-first display, audit records, and removal notifications. |
| PB-007 | Download and read approved books offline | Essential for the first viable product | Readers | Allows readers to store EPUB/PDF copies in IndexedDB and read without network access. |
| PB-008 | Approve or reject submitted books | Essential for the first viable product | Moderators, Publishers, Readers | Ensures only approved books appear publicly and gives publishers rejection status. |
| PB-009 | Provide a seeded moderator test account | Essential for the first viable product | Moderators, QA, Product team | Makes the complete publishing-to-approval workflow testable locally and in demonstrations. |

### First viable product constraints

- Book uploads accept EPUB and PDF files up to 20 MB.
- New submissions remain pending and private until moderator approval.
- Rejection creates an immediate in-app notification and schedules Supabase file
  deletion 24 hours later.
- IndexedDB is the local authority for structured data and offline files; online
  data synchronizes with Firestore.
- Local development uses a mock authentication service compatible with the
  cloud authentication contract.
- Download states are `Not Started`, `In Progress`, `Completed`, and `Failed`.
- Email is limited to 50 characters; passwords are 8–20 characters with an
  uppercase letter, lowercase letter, number, and special character; titles are
  limited to 100 characters.

## Sprint 2 and Sprint 3 Backlog

These items are explicitly excluded from the first viable product and are
planned for later stages.

| ID | Capability | Priority | Related users | Value |
|---|---|---|---|---|
| PB-010 | Create and manage book collections | Sprint 3 | Readers, Publishers | Organize related books and series. |
| PB-011 | Save books to favorites | Sprint 3 | Readers, Publishers | Quickly return to saved books. |
| PB-012 | Notify users about favorited book updates | Sprint 3 | Readers, Publishers | Notify interested readers without exposing other users. |
| PB-013 | Rate books | Sprint 3 | Readers | Provide useful feedback with a one-rating-per-reader model. |
| PB-014 | Follow publishers | Sprint 3 | Readers | Let readers follow approved publishers. |
| PB-015 | Expand moderation of content and users | Sprint 2/Sprint 3 | Moderators | Ban users, remove publishers/books, restore accounts, and maintain audit evidence. |
| PB-016 | Set book prices and use a dummy purchase flow | Sprint 3 | Publishers, Readers | Demonstrate pricing and purchase behavior without real payments. |
| PB-017 | Admin-approved publisher applications | Sprint 2 | Readers, Publishers, Moderators | Prevent unverified users from uploading and consuming bucket storage. |
| PB-018 | Cloud synchronization and conflict handling | Sprint 2 | Product team | Keep Firestore and IndexedDB changes stable and explicit. |
| PB-019 | Scheduled rejection and deletion operations | Sprint 2 | Moderators, Publishers | Complete 24-hour cleanup safely and idempotently. |
| PB-020 | Admin account management and auditability | Sprint 2 | Moderators | Provide administrative controls and traceable actions. |
| PB-021 | Secure session, token, logout, and account-deletion lifecycle | Sprint 2 | Readers, Publishers, Moderators | Complete authentication lifecycle behavior. |
| PB-022 | Deployment, observability, backup, and release verification | Sprint 2 | Product team | Make Netlify, Render, Firebase, Firestore, and Supabase operational. |

## Planning Notes

> [!NOTE]
> Purchasing, pricing, and payment are represented by a dummy system for future
> testing; they are not part of the first viable product.

- **Traceability:** Every backlog item must link to user stories, acceptance
  criteria, a specification section, an owner, and verification evidence.
- **Before each sprint:** Review priorities, dependencies, and scope boundaries.
- **Before implementation:** Define and approve acceptance criteria and the
  relevant specification.
- **Execution:** The system must be deployment-ready and testable locally.
- **Scope control:** Sprint 2 and Sprint 3 items require their corresponding
  specification and acceptance register before implementation.
- **Publisher security:** Public registration never grants publisher status.
  Publisher privileges require an approved application and server-side role
  grant by an administrator.
- **Language:** Sprint 2 and Sprint 3 documentation, source comments, UI text,
  test names, commits, and agent logs must be in English.
- **Validation:** Product indicators are measured through the acceptance tests
  defined in `docs/product/product-goal.md`.