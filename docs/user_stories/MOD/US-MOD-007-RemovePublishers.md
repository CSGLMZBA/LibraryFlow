## US-MOD-007 – Remove publishers

## User Story
As a moderator, I want to remove publishers from the platform, so that I can manage the user base and maintain the integrity of the library.

## Acceptance Criteria

### CA-001 – Remove a publisher

Given that the moderator has permission to remove publishers  
When they select a publisher and confirm removal  
Then the publisher must no longer be able to publish books 
And the publisher must be notified of their removal with a reason.

## Business rules
- **RN-001:** Only authorized moderators may remove publishers.
- **RN-002:** Publishers must be notified of their removal status and reason.

## Dependencies
- US-REA-010 and role-based authorization.