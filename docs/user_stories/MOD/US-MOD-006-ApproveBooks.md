## US-MOD-006 – Approve books

## User Story

As a moderator, I want to approve books, so that only verified and trustworthy content is available to readers.

The Sprint 1 test environment includes a seeded moderator account with the
moderator role.

## Acceptance Criteria

### CA-001 – Approve a book

Given that the moderator has permission to approve books  
When they select a book and confirm approval  
Then the book must be marked as approved in persistent storage  
And the book must be visible in the public library.

### CA-002 – Reject a book

Given that the moderator has permission to approve books  
When they select a book and confirm rejection  
Then the book must be marked as rejected in persistent storage
And the publisher must receive an in-app notification immediately with the
reason
And the file must be scheduled for deletion from bucket storage 24 hours after
rejection.

## Business rules

- **RN-001:** Only authorized moderators may approve or reject books.
- **RN-002:** Publishers must be notified of their approval or rejection status.
- **RN-003:** Files marked for deletion must be removed from bucket storage 24
  hours after rejection.
- **RN-004:** The seeded moderator account must be available in local and test
  environments.

## Dependencies

- US-REA-010 and role-based authorization.