# US-REA-010 – Register and log in

## User Story

As a reader, I want to register and log in securely, so that I can access the library and participate in the community.

## Acceptance Criteria

### CA-001 – Register successfully

Given that the reader provides a valid unique email and password  
When they submit registration  
Then an account must be created  
And the reader must be informed that registration succeeded.

### CA-002 – Reject invalid registration

Given that the email is invalid, already registered, or the password is invalid  
When the reader submits registration  
Then the account must not be created  
And a field-specific error must be displayed.

### CA-003 – Log in successfully

Given that the reader has a registered account  
When they provide valid credentials  
Then they must be authenticated  
And the application must show their authorized features.

### CA-004 – Reject invalid credentials

Given that the credentials are incorrect  
When the reader attempts to log in  
Then access must be denied  
And the reader must receive a clear error without revealing which credential was incorrect.

## Business rules

- **RN-001:** Each account must have a unique email.
- **RN-002:** Passwords must never be stored in plain text.
- **RN-003:** Unauthenticated readers may browse only public content.
- **RN-004:** A reader must be authenticated before publishing comments or managing favorites and collections.

## Dependencies

- Firebase Authentication must be configured according to SPEC-000.
- Public book browsing must be available.

## Out of Scope

* Social login
* Multi-factor authentication
* Account deletion
* Administrative user management
