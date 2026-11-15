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

### CA-006 – Default display name
Given that the reader has successfully registered
When they log in for the first time
Then the system must automatically set their unique display name to the part of their email before the "@" plus a random 4-digit number (e.g., "johnsmith1234")

### CA-007 – Support local development authentication

Given that the application is running in local development or test mode
When a reader, publisher, or moderator registers or logs in
Then the mock authentication service must provide the same registration,
credential validation, session, and role behavior as the cloud authentication
boundary
And the user must be able to continue using the application without network
access.

### Validation rules

- Email must use a standard email format and be no longer than 50 characters.
- Passwords must be between 8 and 20 characters and include at least one
  uppercase letter, one lowercase letter, one number, and one special character.


## Business rules

- **RN-001:** Each account must have a unique email.
- **RN-002:** Passwords must never be stored in plain text.
- **RN-003:** Unauthenticated readers may browse only public content.
- **RN-004:** A reader must be authenticated before publishing comments or managing favorites and collections.
- **RN-005:** The local mock authentication service must never store passwords in
  plain text and must expose the same role and session contract as the cloud
  authentication service.
- **RN-006:** Sprint 1 roles are reader, publisher, and moderator. A seeded
  moderator account is required for local and test environments.

## Dependencies

- The cloud authentication adapter must be compatible with Firebase
  Authentication.
- The local mock authentication service must implement the same contract for
  registration, login, sessions, and roles.
- Public book browsing must be available.

## Out of Scope

* Social login
* Multi-factor authentication
* Account deletion
* Administrative user management
