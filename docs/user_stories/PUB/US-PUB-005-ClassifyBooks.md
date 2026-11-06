# US-PUB-005 – Classify books

## User Story

As a publisher, I want to classify my books, so that they reach the intended audience and are easier to discover.

## Acceptance Criteria

### CA-001 – Assign category and genre

Given that the publisher owns a book and valid category and genre values exist  
When they assign classifications  
Then the classifications must be saved on the book  
And they must be visible in the book details.

### CA-002 – Update classification

Given that the publisher owns a classified book  
When they replace its category or genre with valid values  
Then the new classifications must be saved  
And the previous values must no longer be active.

### CA-003 – Require valid classifications

Given that a selected category or genre does not exist  
When the publisher submits the classification  
Then the change must be rejected  
And the publisher must be told which value is invalid.

### CA-004 – Use classifications in discovery

Given that a book has saved classifications  
When a reader or publisher searches using those classifications  
Then the book must be eligible for the matching results.

## Business rules

- **RN-001:** Only the owning publisher or an authorized moderator may classify a book.
- **RN-002:** A classification must use values managed by moderators.
- **RN-003:** Classification changes must persist between sessions.
- **RN-004:** A book must not reference deleted or nonexistent category and genre values.

## Dependencies

- US-PUB-001 must provide published books.
- US-MOD-001 and US-MOD-002 must provide valid category and genre values.
- US-REA-011 must use saved classifications for filtering.

## Out of Scope

* Creating or editing categories and genres
* Automatic classification
* Personalized audience targeting
* Changing book ownership
