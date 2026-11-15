# LibraryFlow Product Goal

## 1. Product Goal

Enable a community of readers and publishers to share and discuss books.

## 2. Problem It Solves

Simplify book distribution by making it faster, consumer-friendly, and transparent.

## 3. Target Users

- Everyday readers
- Small publishing teams
- Independent publishers

## 4. Expected Value

Provide a lightweight, easy-to-use solution that improves the user experience, encourages community interaction, and allows users to keep control of their media.

## 5. Observable Indicators

The following indicators define how the first viable product will be evaluated.
They must be measured during acceptance testing with seeded test data and
recorded in the Sprint 1 evidence register.

| Indicator | Target for the first viable product | Measurement method |
|---|---|---|
| Registration and authentication completion | A new reader or publisher can register and log in successfully, while invalid credentials and duplicate emails are rejected with field-specific feedback. | Execute the authentication acceptance tests for valid, duplicate, malformed, and invalid-credential scenarios. |
| Book publishing workflow completion | An authenticated publisher can submit a valid EPUB or PDF under 20 MB, and the book is persisted as pending approval without appearing publicly before approval. | Submit a valid book, reload the application, and verify ownership, persistence, lifecycle state, and public visibility. |
| Moderation workflow completion | A seeded moderator can approve or reject a pending book. Approval makes it public; rejection creates an immediate in-app notification and schedules file deletion for 24 hours later. | Execute the approval and rejection acceptance tests and inspect persisted state, visibility, notification, and deletion schedule. |
| Catalog discovery accuracy | Searches are case-insensitive, combined text and category/genre filters return only matching approved books, and no-match queries show an empty state. | Run the reader and publisher search test cases using known matching and non-matching fixtures. |
| Metadata and classification integrity | Authorized publishers can update their own metadata and classifications without changing book identity or ownership; unauthorized or invalid changes are rejected without mutation. | Execute ownership, validation, identity-preservation, persistence, and filter-integration tests. |
| Community participation | An authenticated reader can publish a book-scoped comment, comments appear newest first, and a moderator can remove a violating comment with an audit record and author notification. | Execute comment creation, ordering, moderation, audit, and notification tests. |
| Offline reading completion | A reader can download an approved EPUB or PDF, see the complete download state transition, and open the completed copy without network access. | Simulate online download, reload, disable network access, and verify offline reading and title/author identity. |
| Failure handling | Invalid files, files over 20 MB, failed downloads, quota failures, and unauthorized actions do not create incomplete or unauthorized records and provide actionable errors. | Execute negative-path acceptance tests and verify no partial or success-shaped fallback remains. |
| Local persistence and synchronization | Data remains available after reload in local mode, and online synchronization with Firestore preserves stable identities and resolves conflicts explicitly. | Perform reload and offline/online transition tests, then inspect synchronization results and conflict evidence. |
| Usable local execution | The Sprint 1 increment starts locally from the documented VS Code workflow and supports the complete seeded demo path without an external service dependency. | Run the local setup and end-to-end demo checklist on a clean development environment. |