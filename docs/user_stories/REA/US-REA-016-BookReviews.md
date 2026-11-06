## US-REA-016 Book Reviews

## User Story

As a reader, I want to rate books out of 5 stars, so that I can provide feedback on the quality of the books I read and help other readers make informed decisions.

## Acceptance Criteria

### CA-001 – Rate a book
Given that the reader is authenticated and has purchased a book  
When they select a book and submit a rating out of 5 stars  
Then the rating must be stored in persistent storage
And the average rating for the book must be updated accordingly.

### CA-002 – Prevent multiple ratings
Given that the reader has already rated a book  
When they attempt to submit another rating for the same book  
Then the system must prevent the submission of multiple ratings for the same book by the same reader
And the reader must be notified that they have already rated the book.

### CA-003 – View average rating
Given that a book has been rated by multiple readers  
When a reader views the book's details  
Then the average rating for the book must be displayed, calculated from all submitted ratings.

### CA-004 – Update rating
Given that the reader has already rated a book  
When they choose to update their rating for the book
Then the system must allow them to submit a new rating
And the average rating for the book must be recalculated and updated accordingly.

### CA-005 – Delete rating
Given that the reader has already rated a book  
When they choose to delete their rating for the book
Then the system must remove their rating from persistent storage
And the average rating for the book must be recalculated and updated accordingly.

### CA-006 – Invalid rating
Given that a request is made to submit a rating that is not between 1 and 5 stars  
When the reader attempts to submit the rating  
Then the system must reject the submission
And the reader must be notified that the rating is invalid and indicated to use the ui.

### CA-007 – Show individual ratings
Given that a book has been rated by multiple readers  
When a reader views the book's details
Then the system must display a list of individual ratings, including the rating value and the reader's username or identifier, if available.

## Business rules
- **RN-001:** Only authenticated readers may rate books.
- **RN-002:** Each reader may submit only one rating per book, but they may update or delete their rating.
- **RN-003:** The system must calculate and display the average rating for each book based on all submitted ratings.
- **RN-004:** The system must maintain a record of individual ratings, including the reader's identifier and the rating value, for display purposes.

## Dependencies
- US-REA-010 and role-based authorization.
- US-REA-014 must provide the book purchase functionality to ensure that only readers who have purchased a book can rate it.