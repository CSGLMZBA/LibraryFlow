## US-MOD-009 – Manage credit requests

## User Story

As a moderator, I want to manage credit requests, so that I can approve or reject users' requests to add credits to their accounts.

## Acceptance Criteria

### CA-001 – View pending credit requests

Given that the moderator has permission to manage credit requests  
When they access the credit request management interface  
Then they must see a list of all pending credit requests with relevant details (user, amount, date, etc.).

### CA-002 – Approve a credit request

Given that the moderator has permission to manage credit requests  
When they select a pending credit request and confirm approval  
Then the credit request must be marked as approved in persistent storage
And the user's account balance must be updated with the approved amount
And the user must be notified that their credit request has been approved and their balance updated.

### CA-003 – Reject a credit request
Given that the moderator has permission to manage credit requests  
When they select a pending credit request and confirm rejection and provide a reason for rejection
Then the credit request must be marked as rejected in persistent storage
And the user's account balance must remain unchanged
And the user must be notified that their credit request has been rejected with a reason.

## Business rules
- **RN-001:** Only authorized moderators may manage credit requests.
- **RN-002:** The system must maintain a record of all credit requests, including the user ID, requested amount, status (pending, approved, rejected), and timestamps for creation and status changes.
- **RN-003:** The system must notify users of the status of their credit requests (approved or rejected) along with any relevant details.

## Dependencies
- US-REA-010 and role-based authorization.
- US-REA-015 must provide the credit request functionality.
