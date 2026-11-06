# US-MOD-005 – Approve publishers

## User Story

As a moderator, I want to approve publishers, so that only verified and trustworthy publishers can add books to the platform.

## Acceptance Criteria

### CA-001 – Approve a publisher    

Given that the moderator has permission to approve publishers  
When they select a publisher and confirm approval  
Then the publisher must be marked as approved in persistent storage  
And the publisher must be notified of their approval.

### CA-002 – Reject a publisher

Given that the moderator has permission to approve publishers  
When they select a publisher and confirm rejection  
Then the publisher must be marked as rejected in persistent storage  
And the publisher must be notified of their rejection with a reason.

## Business rules

- **RN-001:** Only authorized moderators may approve or reject publishers.
- **RN-002:** Publishers must be notified of their approval or rejection status.

## Dependencies

- US-REA-010 and role-based authorization.
- US-REA-013 must provide the publisher status request functionality.