# US-REA-021 - Follow Publishers

## User Story

As a reader, I want to follow approved publishers, so that I can discover their
new and updated books.

## Acceptance Criteria

### CA-001 - Follow a Publisher

Given that I am signed in and the publisher is approved
When I follow the publisher
Then one stable follow record is created.

### CA-002 - Unfollow a Publisher

Given that I already follow a publisher
When I unfollow it
Then the follow record is removed.

### CA-003 - Prevent Duplicate Follows

Given that I already follow a publisher
When I attempt to follow it again
Then the duplicate action is rejected or returns the existing state.

### CA-004 - View Followed Publishers

Given that I follow approved publishers
When I open my followed-publisher list
Then only my active follows are displayed.

### CA-005 - Notify about Updates

Given that I follow a publisher
When an approved book receives a new update
Then at most one in-app notification is created for my account.

## Business Rules

- **RN-001:** Only signed-in readers may follow publishers.
- **RN-002:** Only approved publishers may be followed.
- **RN-003:** A reader may follow a publisher only once.
- **RN-004:** Follow records are private to the reader.

## Dependencies

- US-REA-010: authentication
- US-REA-013: publisher applications
- US-MOD-005: approved publisher role
