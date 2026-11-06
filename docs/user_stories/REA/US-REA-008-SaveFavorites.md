# US-REA-008 – Save favorite books

## User Story

As a reader, I want to save books to favorites, so that I can quickly find works that interest me later.

## Acceptance Criteria

### CA-001 – Add a favorite

Given that the reader is authenticated and a public book is available  
When they select the favorite action  
Then the book must be added to that reader's favorites.

### CA-002 – Remove a favorite

Given that a book is already in the reader's favorites  
When they select the unfavorite action  
Then the book must be removed from their favorites.

### CA-003 – View favorites

Given that the reader has saved favorites  
When they open their favorites  
Then all currently available saved books must be listed.

### CA-004 – Keep favorites private

Given that a reader has saved favorites  
When another user views their own favorites  
Then the other user's list must not include the first reader's private favorites.

## Business rules

- **RN-001:** A reader must be authenticated to manage favorites.
- **RN-002:** A reader may have at most one favorite entry for a book.
- **RN-003:** Favorite entries must be associated with their owning reader.
- **RN-004:** Books removed from public access must not be presented as available favorites.

## Dependencies

- US-REA-010 must provide authentication.
- US-PUB-001 must provide published books.
- Persistent per-reader favorite storage must be available.

## Out of Scope

* Sharing favorites with other users
* Personalized recommendations
* Ratings or reviews
* Favorite folders
