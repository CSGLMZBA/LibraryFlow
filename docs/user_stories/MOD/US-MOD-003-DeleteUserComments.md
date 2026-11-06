# US-MOD-003 – Delete user comments

## User Story

As a moderator, I want to delete comments that violate the platform's rules, so that the community remains safe and respectful for all users.

## Acceptance Criteria

### CA-001 – Delete a violating comment

Given that the moderator has permission to moderate comments  
When they select a comment and confirm deletion  
Then the comment must no longer be visible to readers  
And the comment must be marked as deleted in persistent storage.

### CA-002 – Require confirmation

Given that the moderator selects a comment for deletion  
When the confirmation prompt is displayed and the moderator cancels  
Then the comment must remain unchanged and visible.

### CA-003 – Record the moderation action

Given that a moderator deletes a comment  
When the deletion succeeds  
Then the system must retain the moderator identifier, comment identifier, reason, and deletion time for audit purposes.

### CA-004 – Reject unauthorized deletion

Given that the current user is not an authorized moderator  
When they attempt to delete a comment  
Then the comment must not be deleted  
And the user must receive an authorization error.

## Business rules

- **RN-001:** Only authorized moderators may delete comments.
- **RN-002:** Deletion requires explicit confirmation.
- **RN-003:** Deleted comments must not appear in normal reader or publisher views.
- **RN-004:** The author and moderator must remain identifiable in the audit record.
- **RN-005:** Deleting a comment must not delete the associated book or user account.

## Dependencies

- US-REA-002 must provide authenticated users and comments.
- US-REA-005 and US-PUB-003 must provide comments to moderate.
- The system must provide role-based access and persistent comment storage.

## Out of Scope

* Editing comments
* Restoring deleted comments
* Banning users
* Moderating books or publisher accounts
