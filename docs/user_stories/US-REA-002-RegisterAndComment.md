# US-REA-002 – Register and comment

## User Story

As a reader, I want to register and log in to the digital library, so that I can comment on books.

## Acceptance Criteria

### CA-001 – Register an account

Given that the reader provides a valid unique email and password  
When they submit registration  
Then an account must be created  
And the reader must be informed that registration succeeded.

### CA-002 – Log in to the library

Given that the reader has a registered account  
When they provide valid credentials  
Then they must be authenticated  
And commenting features must be available.

### CA-003 – Reject invalid credentials

Given that the email or password is incorrect  
When the reader attempts to log in  
Then access must be denied  
And a clear error must be shown without revealing which credential was incorrect.

### CA-004 – Allow authenticated commenting

Given that the reader is authenticated  
When they submit valid comment text on a book  
Then the comment must be created and associated with that reader and book.

## Business rules

- **RN-001:** Each account must have a unique email.
- **RN-002:** Passwords must never be stored in plain text.
- **RN-003:** Only authenticated readers may publish comments.
- **RN-004:** Comment text must be validated before it is stored.

## Dependencies

- US-REA-010 must provide authentication.
- US-REA-012 must provide comment creation and storage.
- US-PUB-001 must provide books.

## Out of Scope

* Social login
* Multi-factor authentication
* Account deletion
* Editing comments after publication
