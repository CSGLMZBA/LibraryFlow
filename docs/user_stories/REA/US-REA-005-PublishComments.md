# US-REA-005 – Publish comments

## User Story

As a reader, I want to publish comments on books, so that I can participate in the community and share my thoughts with other users.

## Acceptance Criteria

### CA-001 – Publish a valid comment

Given that the reader is authenticated and enters valid text  
When they submit the comment  
Then it must be attached to the selected book  
And the author and publication time must be displayed.

### CA-002 – Require comment text

Given that the comment is empty or contains only whitespace  
When the reader submits it  
Then the comment must not be created  
And the reader must be told that text is required.

### CA-003 – Protect unauthenticated users

Given that the visitor is not authenticated  
When they try to publish a comment  
Then the comment must not be created  
And they must be directed to log in or register.

### CA-004 – Display the new comment

Given that a comment was published successfully  
When the comment section is refreshed  
Then the new comment must appear under the selected book.

## Business rules

- **RN-001:** Only authenticated readers may publish comments.
- **RN-002:** A comment must belong to exactly one book and one author.
- **RN-003:** Comment text must be normalized before validation and storage.
- **RN-004:** Authorized moderators may remove comments under US-MOD-003.

## Dependencies

- US-REA-010 must provide authentication.
- US-PUB-001 must provide books.
- Persistent comment storage must be available.

## Out of Scope

* Comment editing
* Direct messaging
* Reactions or voting
* Automatic moderation
