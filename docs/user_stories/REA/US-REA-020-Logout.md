## US-REA-020 – Logout

## User Story

As a reader, I want to log out of my account, so that I can ensure my account is secure and prevent unauthorized access.

## Acceptance Criteria

### CA-001 – Successful logout
Given that the reader is authenticated and has an active session
When the reader selects the logout option  
Then the system must terminate the session and redirect the reader to the login page.

### CA-002 – Session termination
Given that the reader is authenticated and has an active session
When the reader logs out
Then the system must invalidate the session token and prevent further access to authenticated resources without re-authentication.

### CA-003 – Logout confirmation
Given that the reader is authenticated and has an active session
When the reader selects the logout option
Then the system must display a confirmation message indicating that the logout was successful.

### CA-004 – Expired Token Access
Given that the reader has logged out and the session token is invalidated
When the reader attempts to access any authenticated resource
Then the system must deny access and redirect the reader to the login page and notify them that their session has expired or they have been logged out.

## Business rules
- **RN-001:** Only authenticated readers may log out of their accounts.
- **RN-002:** The system must ensure that session tokens are invalidated upon logout to prevent unauthorized access.
- **RN-003:** The system must provide a clear confirmation message upon successful logout to inform the reader that they have been logged out of their account.
- **RN-004:** The system must notify the reader when their session has expired or they have been logged out.

## Dependencies
- US-REA-010 and role-based authorization.