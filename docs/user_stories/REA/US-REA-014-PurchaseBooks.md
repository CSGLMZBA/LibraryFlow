## US-REA-014 – Purchase Books

As a reader, I want to purchase books, so that I can access and read the content I am interested in.

### Acceptance Criteria

### CA-001 – Purchase a book
Given that the reader is authenticated and has enough funds in their account  
When they select a book and confirm the purchase  
Then the book must be marked as purchased in persistent storage

### CA-002 – Insufficient funds
Given that the reader is authenticated but does not have enough funds in their account  
When they attempt to purchase a book  
Then the purchase must be denied
And the reader must be notified of insufficient funds.

## Business rules
- **RN-001:** Only authenticated readers may purchase books.
- **RN-002:** The system must check the reader's account balance before processing a purchase
- **RN-003:** The system must update the reader's account balance after a successful purchase.

## Dependencies
- US-REA-010 and role-based authorization.