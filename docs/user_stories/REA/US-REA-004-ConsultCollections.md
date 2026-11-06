# US-REA-004 – Consult collections

## User Story

As a reader, I want to consult book collections, so that related books are kept together and easy to browse.

## Acceptance Criteria

### CA-001 – List available collections

Given that collections contain public books  
When the reader opens the collections area  
Then available collections must be listed with their names.

### CA-002 – Open a collection

Given that a collection exists  
When the reader selects it  
Then the collection name and its public books must be displayed.

### CA-003 – Open a book from a collection

Given that a collection contains a public book  
When the reader selects the book  
Then the book details must be opened.

### CA-004 – Handle an empty collection

Given that a collection has no public books  
When the reader opens it  
Then an empty-state message must be shown.

## Business rules

- **RN-001:** Readers may view only collections and books available to them.
- **RN-002:** A collection must have a stable identifier and name.
- **RN-003:** Books removed from public access must not be displayed as available.
- **RN-004:** Collection membership must reflect persisted data.

## Dependencies

- US-REA-006 must provide collections.
- US-PUB-001 must provide published books.

## Out of Scope

* Creating or editing collections
* Collaborative collections
* Personalized collection recommendations
