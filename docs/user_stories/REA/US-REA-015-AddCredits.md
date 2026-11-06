## US-REA-015 – Add credits

## User Story

As a user, I want to add credits to my account, so that I can purchase books or other content on the platform.

## Acceptance Criteria

### CA-001 – Add credits
Given that the user is authenticated
When they select the option to add credits and request a specific amount
Then the system must create a credit request and set it as pending in persistent storage
And the user must be notified that their credit request is pending approval.

### CA-002 – Approved credit request
Given that the moderator has approved the user's credit request
When the system processes the approval
Then the user's account balance must be updated with the approved amount
And the user must be notified that their credit request has been approved and their balance updated.

### CA-003 – Rejected credit request
Given that the moderator has rejected the user's credit request
When the system processes the rejection 
Then the user's account balance must remain unchanged
And the user must be notified that their credit request has been rejected with a reason.

### CA-004 – Invalid credit request
Given that the user submits a credit request with an invalid amount (e.g., negative or zero)
When they attempt to submit the request
Then the system must not create a credit request
And the user must be notified that the credit request amount is invalid.

## Business rules
- **RN-001:** Only authenticated users may request to add credits.
- **RN-002:** Credit requests must be reviewed and approved or rejected by a moderator.
- **RN-003:** The system must notify users of the status of their credit requests (approved or rejected) along with any relevant details.
- **RN-004:** The system must maintain a record of all credit requests, including the user ID, requested amount, status (pending, approved, rejected), and timestamps for creation and status changes.
