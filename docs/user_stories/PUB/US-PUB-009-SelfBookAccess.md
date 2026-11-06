## US-PUB-009 – Self-book access

## User Story
As a publisher, I want to have self-book access, so that I can view and manage my own books without needing to purchase them.

## Acceptance Criteria

### CA-001 – Access own books
Given that the publisher is authenticated and has published books  
When they navigate to their book management section  
Then they must be able to view a list of all their published books
And they must be able to access the content of their own books without purchasing them.

### CA-002 – Spoofing prevention
Given that the publisher is authenticated
When they attempt to access a book that they did not publish
Then access must be denied
And the publisher must receive a clear error message indicating that they do not have permission to access that book.
And a system alert must be logged for any unauthorized access attempts.

## Business rules
- **RN-001:** Only authenticated publishers may access their own books.
- **RN-002:** The system must verify the publisher's identity and ownership of the book
- **RN-003:** The system must log all access attempts to books, including successful and
    unsuccessful attempts, for audit purposes.

## Dependencies
- US-PUB-001 and role-based authorization
- US-REA-010 and user authentication

