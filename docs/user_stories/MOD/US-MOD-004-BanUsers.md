# US-MOD-004 – Ban users

## User Story

As a moderator, I want to temporarily or permanently ban users who violate platform rules, so that the community remains safe and respectful.

## Acceptance Criteria

### CA-001 – Apply a temporary ban

Given that the moderator has selected a user and a valid end time  
When they confirm the ban  
Then the user must be prevented from restricted actions until that time  
And the reason and moderator must be recorded.

### CA-002 – Apply a permanent ban

Given that the violation requires permanent removal  
When the moderator confirms a permanent ban  
Then the user must remain restricted until an authorized moderator lifts the ban.

### CA-003 – Reject unauthorized actions

Given that the current user is not an authorized moderator  
When they attempt to ban a user  
Then the action must be rejected and recorded as unauthorized.

## Business rules

- **RN-001:** Every ban must have a reason, actor, start time, and duration or permanent flag.
- **RN-002:** Banned users may not publish comments or books.
- **RN-003:** A moderator may lift a ban only with appropriate permission.
- **RN-004:** The system must log all ban actions for audit purposes.
- **RN-005:** The system must notify the banned user of their ban status, reason, and duration.
- **RN-006:** The system must hide the content of banned users from public view, including comments and books, until the ban is lifted.

## Dependencies

- US-REA-010 and role-based authorization.
- US-REA-012 and US-PUB-006 must enforce the ban.

## Out of Scope

* Automated bans
* IP blocking
* Legal identity verification
