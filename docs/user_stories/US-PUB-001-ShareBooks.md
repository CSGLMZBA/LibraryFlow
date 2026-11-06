# US-PUB-001 – Share books

## User Story

As a publisher, I want to share my books through the platform, so that readers can easily discover and access them.

## Acceptance Criteria

### CA-001 – Publish a valid book

Given that the publisher is authenticated and provides a title, author, description, and book content  
When they submit the book  
Then the book must be stored and published  
And it must be visible in the public library.

### CA-002 – Require book information

Given that a required field is empty or invalid  
When the publisher submits the book  
Then the book must not be published  
And the missing or invalid field must be identified.

### CA-003 – Show public book details

Given that a book is published  
When a reader opens it  
Then the title, author, description, publisher, publication date, and access action must be shown.

### CA-004 – Preserve publisher ownership

Given that a publisher submits a book  
When the book is stored  
Then the authenticated publisher must be recorded as its owner.

## Business rules

- **RN-001:** Only authenticated publishers may publish books.
- **RN-002:** Every published book must have a unique identifier.
- **RN-003:** Book metadata and content must persist between sessions.
- **RN-004:** A publisher may manage only books they own, subject to moderation rules.

## Dependencies

- US-REA-010 must provide authentication.
- Persistent book metadata and file storage must be configured.

## Out of Scope

* Payments
* Copyright verification
* Collaborative editing
* Automatic content moderation
