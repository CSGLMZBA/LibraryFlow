# US-MOD-005 - Approve Publishers

## User Story

As an administrator, I want to approve or reject publisher applications, so
that only verified accounts can upload books and consume storage.

## Acceptance Criteria

### CA-001 - Approve a Publisher

Given that an administrator selects a pending publisher application
When they confirm approval
Then the application becomes approved
And the account role is changed from `reader` to `publisher` atomically
And the applicant receives an in-app notification.

### CA-002 - Reject a Publisher

Given that an administrator selects a pending publisher application
When they confirm rejection with a reason
Then the application becomes rejected
And the account remains a reader
And the applicant receives the reason in an in-app notification.

## Business rules

- **RN-001:** Only authorized administrators/moderators may approve or reject applications.
- **RN-002:** Approval is a server-side, atomic role change; the frontend is not authoritative.
- **RN-003:** Rejection must not create publisher privileges.
- **RN-004:** A pending application may not upload, create, or store books.
- **RN-005:** Approval and rejection decisions must be audited.

## Dependencies

- US-REA-010 and role-based authorization.
- US-REA-013 must provide the publisher status request functionality.