# US-REA-011 – Search and filter books

## User Story

As a reader, I want to search and filter books by relevant information, so that I can quickly find books that interest me.

## Acceptance Criteria

### CA-001 – Search by text

Given that public books exist  
When the reader searches by title, author, or publisher  
Then matching books must be displayed.

### CA-002 – Filter by category and genre

Given that books have categories or genres  
When the reader selects one or more filters  
Then only books matching the selected filters must be displayed.

### CA-003 – Combine search and filters

Given that the reader enters search text and selects filters  
When the search is executed  
Then the results must satisfy both the text query and the selected filters.

### CA-004 – No matching results

Given that no book matches the query  
When the search completes  
Then the system must show an empty-state message  
And it must not display unrelated books as matches.

## Business rules

- **RN-001:** Search results must include only publicly available books.
- **RN-002:** Search must be case-insensitive.Session Info
Context Window
50.3K / 272K tokens
18%

- **RN-003:** A missing or empty query must show the default public catalog.
- **RN-004:** Filters must be based on the category and genre values assigned to books.

## Dependencies

- US-PUB-006 must provide published books and metadata.
- US-MOD-001 and US-MOD-002 must provide category and genre values.

## Out of Scope

* Personalized recommendations
* Full-text search inside book files
* Search ranking based on reader behavior
