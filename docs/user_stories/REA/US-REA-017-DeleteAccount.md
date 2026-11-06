## US-REA-017 – Delete Account

## User Story

As a user, I want to delete my account, so that I can remove my personal information and data from the platform.

## Acceptance Criteria

### CA-001 – Delete account
Given that a user is logged in  
When they choose to delete their account and confirm the action  
Then their account must be marked as logically deleted in persistent storage
And all personal data associated with the account must be removed from the system with a 30 day grace period before permanent deletion.

### CA-002 – Notify user of deletion
Given that a user has requested account deletion  
When the deletion request is processed  
Then the user must receive a confirmation email notifying them of the account deletion request and the 30 day grace period before permanent deletion.

### CA-003 – Prevent login after deletion request
Given that a user has requested account deletion  
When they attempt to log in during the 30 day grace period  
Then the system must prevent them from logging in and display a message indicating that their account is pending deletion and will be permanently deleted after the grace period.

## Business rules
- **RN-001:** Users must be able to request account deletion through their account settings.
- **RN-002:** The system must implement a 30 day grace period before permanent deletion
- **RN-003:** During the grace period, users must be prevented from logging in and accessing their account.
- **RN-004:** The system must delete all personal data in any public fields associated with the account, including comments, reviews, and any other user-generated content.

## Dependencies
- US-REA-010 and role-based authorization.
