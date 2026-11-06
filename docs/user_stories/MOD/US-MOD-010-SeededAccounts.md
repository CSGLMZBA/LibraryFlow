## US-MOD-010 – Seeded Accounts

## User Story

As a moderator, I want there to be seeded accounts for testing and demonstration purposes, so that I can easily showcase the platform's features without needing to create new accounts manually.

## Acceptance Criteria

### CA-001 – Seeded moderator account
Given that the system has seeded accounts  
When a moderator logs in with the seeded moderator credentials  
Then they must have full moderator permissions and access to all moderation features.

### CA-002 – Seeded publisher account
Given that the system has seeded accounts
When a publisher logs in with the seeded publisher credentials  
Then they must have full publisher permissions and access to all publishing features.

### CA-003 – Seeded reader account
Given that the system has seeded accounts
When a reader logs in with the seeded reader credentials
Then they must have full reader permissions and access to all reading features and unlimited credits for purchasing books.

### CA-004 – Create new seeded accounts
Given that a moderator is logged in with seeded moderator credentials  
When they create a new seeded account for a publisher or reader  
Then the new seeded account must be created with predefined credentials and roles.

## Business rules
- **RN-001:** Seeded accounts must be created with predefined credentials and roles.
- **RN-002:** Seeded accounts must be reset to their initial state after each test cycle.
- **RN-003:** Seeded accounts must not be used for production purposes and should be clearly marked as test accounts.

### Dependencies
- US-REA-010 and role-based authorization.
