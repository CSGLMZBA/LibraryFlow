# US-REA-012 – Comment on books

## User Story

As a reader, I want to publish a comment on a book, so that I can share my opinion and participate in the community.

## Acceptance Criteria

### CA-001 – Publish a valid comment

Given that the reader is authenticated and enters valid text  
When they submit the comment  
Then the comment must be attached to the selected book  
And the author and publication time must be shown.

### CA-002 – Require comment text

Given that the comment is empty or contains only whitespace  
When the reader submits it  
Then the comment must not be created  
And the reader must be informed that text is required.

### CA-003 – Protect unauthenticated users

Given that the visitor is not authenticated  
When they try to publish a comment  
Then the comment must not be created  
And they must be directed to log in or register.

### CA-004 – Display comments

Given that comments exist for a book  
When a user opens the book  
Then the comments must be displayed in a consistent order with author and time.

## Business rules

- **RN-001:** Only authenticated readers may publish comments.
- **RN-002:** A comment must belong to exactly one book and one author.
- **RN-003:** Comment text is normalized before validation and storage.
- **RN-004:** Comments may be removed by authorized moderators under US-MOD-003.

## Dependencies

- US-REA-010 must provide authentication.
- US-PUB-006 must provide books.
- Persistent comment storage must be available.

## Out of Scope

* Direct messaging
* Comment editing
* Reactions or voting
* Automatic moderation
