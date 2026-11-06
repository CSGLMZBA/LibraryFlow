# US-PUB-003 – View comments on published books

## User Story

As a publisher, I want to view a comments section for my published books, so that I can learn about readers' opinions.

## Acceptance Criteria

### CA-001 – Display book comments

Given that comments exist for a publisher's book  
When the publisher opens the book  
Then the comments must be displayed with the author's name and publication time.

### CA-002 – Keep comments associated with the book

Given that a comment was published on a book  
When the publisher views that book's comments  
Then the comment must appear only in the selected book's comment section.

### CA-003 – Show an empty comment section

Given that a published book has no comments  
When the publisher opens its comment section  
Then an empty-state message must be shown.

### CA-004 – Apply moderation changes

Given that an authorized moderator removes a comment  
When the publisher reloads the comment section  
Then the removed comment must no longer be displayed.

## Business rules

- **RN-001:** Only comments belonging to the selected book may be displayed.
- **RN-002:** Comments must show their author and publication time.
- **RN-003:** Publishers may view comments on public books but may not alter reader comments.
- **RN-004:** Comment removal is governed by US-MOD-003.

## Dependencies

- US-PUB-001 must provide published books.
- US-REA-012 must provide persistent comments.
- US-MOD-003 must provide comment moderation.

## Out of Scope

* Editing or deleting reader comments by publishers
* Direct messaging with commenters
* Comment reactions or voting
* Automatic sentiment analysis
