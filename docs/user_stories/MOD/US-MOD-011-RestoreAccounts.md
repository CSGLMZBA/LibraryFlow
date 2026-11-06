## US-MOD-011 – Restore accounts

## User Story

As a moderator, I want to restore accounts that have been removed, so that I can manage the user base and maintain the integrity of the library.

## Acceptance Criteria

### CA-001 – Restore a user account
Given that the moderator has permission to restore accounts  
When they select a removed user account and confirm restoration  
Then the user account must be marked as active in persistent storage
And the user must be notified of their account restoration.

## Business rules

- **RN-001:** Only authorized moderators may restore accounts.
- **RN-002:** The system must maintain a record of all account restoration actions, including the moderator ID, user ID, and timestamps for restoration.
- **RN-003:** The system must notify users of their account restoration status along with any relevant details.

## Dependencies
- US-REA-010 and role-based authorization.
