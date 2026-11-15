# LibraryFlow Product Backlog

Approved Sprint 1 backlog and future-product roadmap for LibraryFlow.

## Backlog overview

| Priority | Items |
|---|---:|
| Essential for the first viable product | PB-001 to PB-009 |
| Later | PB-010 to PB-016 |

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

## Future backlog

These items are explicitly excluded from the first viable product and are
planned for later stages.

| ID | Capability | Priority | Related users | Value |
|---|---|---|---|---|
| PB-010 | Create and manage book collections | Later | Readers, Publishers | Helps users organize related books and series. |
| PB-011 | Save books to favorites | Later | Readers, Publishers | Makes it easier to return to and track books. |
| PB-012 | Notify users about favorited book updates | Later | Readers, Publishers | Keeps users informed about new chapters and changes. |
| PB-013 | Rate books | Later | Readers | Provides useful feedback about books. |
| PB-014 | Follow publishers | Later | Readers | Helps readers keep up with publishers they follow. |
| PB-015 | Expand moderation of content and users | Later | Moderators | Adds broader safety, account, and platform administration beyond Sprint 1. |
| PB-016 | Set book prices and use a dummy purchase flow | Later | Publishers, Readers | Supports future purchase and payment-flow testing without real transactions. |

## Planning notes

> [!NOTE]
> Purchasing, pricing, and payment are represented by a dummy system for future
> testing; they are not part of the first viable product.

- **Traceability:** Every backlog item must link to user stories, acceptance
  criteria, a specification section, an owner, and verification evidence.
- **Before each sprint:** Review priorities, dependencies, and scope boundaries.
- **Before implementation:** Define and approve acceptance criteria and the
  relevant specification.
- **Execution:** The system must be deployment-ready and testable locally.
- **Scope control:** No future backlog item may be implemented as part of Sprint
  1 without explicit product-owner approval.
- **Validation:** Product indicators are measured through the acceptance tests
  defined in `docs/product/product-goal.md`.