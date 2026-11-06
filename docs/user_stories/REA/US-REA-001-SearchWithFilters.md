# US-REA-001 – Search books with filters

## User Story

As a reader, I want to search by genre, title, author, and publisher, so that I can easily find books that interest me.

## Acceptance Criteria

### CA-001 – Search by text

Given that public books exist  
When the reader searches by title, author, or publisher  
Then matching books must be displayed.

### CA-002 – Filter by genre

Given that books have genre metadata  
When the reader selects a genre  
Then only books assigned to that genre must be displayed.

### CA-003 – Combine search criteria

Given that the reader enters text and selects one or more filters  
When the search is executed  
Then every result must satisfy all selected criteria.

### CA-004 – Handle no matches

Given that no public book matches the search  
When the search completes  
Then an empty-state message must be shown  
And unrelated books must not be displayed.

## Business rules

- **RN-001:** Search results must contain only publicly available books.
- **RN-002:** Text searches must be case-insensitive.
- **RN-003:** An empty query must show the default public catalog.
- **RN-004:** Filters must use the current category, genre, author, and publisher metadata.

## Dependencies

- US-PUB-001 must provide published books and metadata.
- US-PUB-005 must provide book classifications.
- US-MOD-001 and US-MOD-002 must provide category and genre values.

## Out of Scope

* Full-text search inside book files
* Personalized recommendations
* Search ranking based on reader behavior
