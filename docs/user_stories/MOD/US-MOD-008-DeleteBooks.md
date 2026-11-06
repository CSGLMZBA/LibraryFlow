## US-MOD-008 – Delete books

## User Story

As a moderator, I want to delete books from the platform, so that I can manage the content and maintain the integrity of the library.

## Acceptance Criteria

### CA-001 – Delete a book

Given that the moderator has permission to delete books  
When they select a book and confirm deletion  
Then the book must be marked as deleted in persistent storage  
And the book must be removed from the public library
And the publisher must be notified of their book's deletion with a reason.

## Business rules
- **RN-001:** Only authorized moderators may delete books.
- **RN-002:** Publishers must be notified of their book's deletion status and reason.
- **RN-003:** Deleted books must be permanently removed from the system.
- **RN-004:** The deletion process must be logged for audit purposes.
- **RN-005:** Deleted books must be removed from bucket storage.
- **RN-006:** Deleted books must not be recoverable by any user, including moderators and publishers.
- **RN-007:** The system must ensure that deleted books do not appear in search results or public listings.
- **RN-008:** The system must provide a confirmation prompt before finalizing the deletion of a book to prevent accidental deletions.
- **RN-009:** The system must maintain a record of deleted books for reporting and analytics purposes, without exposing the content to any user.
- **RN-010:** The system must ensure that any associated metadata of deleted books is also removed from the database to maintain data integrity.
- **RN-011:** The book page including comments and reviews must be removed from the public library and any associated user interfaces except for the moderators.

## Dependencies
- US-REA-010 and role-based authorization.
