# US-PUB-006 – Share a book

## User Story

As a publisher, I want to share a book with its basic information, so that readers can discover and access it through the library.

## Acceptance Criteria

### CA-001 – Publish a valid book

Given that the publisher provides a title, author, description, and book content  
When they submit the book  
Then the book must be stored and published  
And it must be visible in the public library.

### CA-002 – Require book information

Given that a required field is empty  
When the publisher submits the book  
Then the book must not be published  
And the missing field must be identified to the publisher.

### CA-003 – Show publication details

Given that a book is published  
When a reader opens it  
Then the title, author, description, publisher, publication date, and available access action must be shown.

### CA-004 – Preserve ownership

Given that a publisher submits a book  
When the book is stored  
Then the authenticated publisher must be recorded as its owner.

## Business rules

- **RN-001:** Only authenticated publishers may publish books.
- **RN-002:** A published book must have a unique identifier.
- **RN-003:** A publisher may edit or remove only books they own, subject to moderation rules.
- **RN-004:** Book metadata must be persisted between sessions.

## Dependencies

- US-REA-010 must provide authentication.
- Persistent book storage and file storage must be configured.

## Out of Scope

* Payments
* Copyright verification
* Collaborative editing
* Automatic content moderation
