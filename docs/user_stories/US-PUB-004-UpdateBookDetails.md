# US-PUB-004 – Update book details

## User Story

As a publisher, I want to keep my book details up to date, so that readers always see accurate information.

## Acceptance Criteria

### CA-001 – Update owned book

Given that the publisher owns a published book  
When they submit valid changed metadata  
Then the book must be updated and the new details must be visible to readers.

### CA-002 – Preserve identity

Given that a publisher updates a book  
When the update succeeds  
Then the book identifier, owner, and publication history must remain unchanged.

### CA-003 – Reject invalid or unauthorized updates

Given that metadata is invalid or the publisher does not own the book  
When an update is submitted  
Then no data must change  
And an explanatory error must be shown.

## Business rules

- **RN-001:** Only the owning publisher or an authorized moderator may update book details.
- **RN-002:** Required metadata cannot be empty.
- **RN-003:** Changes must persist between sessions.

## Dependencies

- US-PUB-006 and persistent book metadata.

## Out of Scope

* Changing ownership
* Editing reader comments
* Automatic rewriting of descriptions
