# US-PUB-002 – Search books

## User Story

As a publisher, I want to search for books, so that I can understand which books are available and reaching readers.

## Acceptance Criteria

### CA-001 – Search by book information

Given that public books exist  
When the publisher searches by title, author, or publisher  
Then matching books must be displayed with their basic information.

### CA-002 – Filter search results

Given that books have category or genre metadata  
When the publisher selects a category or genre filter  
Then only matching public books must be displayed.

### CA-003 – Combine text and filters

Given that the publisher enters search text and selects filters  
When the search is executed  
Then every result must satisfy both the text query and the selected filters.

### CA-004 – Handle no matches

Given that no public book matches the search  
When the search completes  
Then an empty-state message must be shown  
And unrelated books must not be presented as matches.

## Business rules

- **RN-001:** Search results must include only publicly available books.
- **RN-002:** Search must be case-insensitive.
- **RN-003:** An empty query must show the default public catalog.
- **RN-004:** Results must reflect the current persisted book metadata.

## Dependencies

- US-PUB-001 must provide published books and metadata.
- US-MOD-001 and US-MOD-002 must provide category and genre values.

## Out of Scope

* Private or unpublished book search
* Personalized recommendations
* Search ranking based on reader behavior
* Full-text search inside book files
