## US-MOD-007 - Remove Publishers

## User Story
As an administrator, I want to revoke publisher access, so that I can remove
storage and publishing privileges while preserving an audit record.

## Acceptance Criteria

### CA-001 - Remove Publisher Privileges

Given that an administrator selects an approved publisher
When they confirm removal with a reason
Then the account role becomes `reader` or is otherwise restricted server-side
And existing books remain private or are handled according to the moderation policy
And the publisher receives an in-app notification.

## Business rules
- **RN-001:** Only authorized administrators/moderators may revoke publisher status.
- **RN-002:** Revocation must immediately block book creation and upload APIs.
- **RN-003:** Revocation must record the actor, reason, and timestamp.

## Dependencies
- US-REA-010 and role-based authorization.