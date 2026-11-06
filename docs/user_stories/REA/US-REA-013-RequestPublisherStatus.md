## US-REA-013 – Request publisher status

## User Story

As a user, I want to request the status of a publisher, so that I can determine if they are approved and trustworthy.

## Acceptance Criteria

### CA-001 – Request publisher status

Given that the user is logged in
And submits a request for publisher status
And the publisher data is filled out correctly
When the request is processed
Then the user must receive a confirmation of their request
And the publisher's status must be put on hold until reviewed.

## CA-002 – Validate publisher data
Given that the user submits a request for publisher status
And the publisher data is incomplete or invalid
When the request is processed
Then the user must receive an error message indicating the missing or invalid data
And the request must not be submitted for review.

## CA-003 – Review publisher status request
Given that the user has submitted a request for publisher status
And the request is pending review
When an administrator reviews the request
Then the administrator must be able to approve or reject the request
And the user must be notified of the decision.

## CA-004 – Notify user of decision
Given that the administrator has reviewed the publisher status request
When the request is approved or rejected
Then the user must receive a notification of the decision
And the publisher's status must be updated accordingly in persistent storage.

## CA-005 – Handle duplicate requests
Given that the user has already submitted a request for publisher status
When they attempt to submit another request
Then the system must prevent the duplicate request
And the user must be notified that their previous request is still pending review or has already been processed

## CA-006 – Handle request expiration
Given that the user has submitted a request for publisher status
And the request has been pending for a specified period (30 days)
When the request has not been reviewed by an administrator
Then the system must automatically mark the request as expired
And the user must be notified that their request has expired and they need to submit a new request.

## CA-007 – Handle request withdrawal
Given that the user has submitted a request for publisher status
And the request is still pending review
When the user chooses to withdraw their request
Then the system must mark the request as withdrawn
And the user must be notified that their request has been successfully withdrawn

## CA-008 – Handle request resubmission
Given that the user has withdrawn or had their request for publisher status rejected
When they choose to resubmit their request
Then the system must allow them to submit a new request
And the user must be notified that their new request has been successfully submitted for review.

## CA-009 – Successful publisher status request
Given that the user has submitted a request for publisher status
And the request has been approved by an administrator
When the request is processed
Then the user's account must be updated to reflect their new publisher status.

#### Publisher details to be filled out in the request form:
- Publisher name
- Publisher's legal representative name.
- Independent publisher status (yes/no)
- Publisher email (default to user's email)
- Publisher website (optional)

## Business rules

- **RN-001:** Only authenticated users may request publisher status.
- **RN-002:** Publisher data must be validated before submission.
- **RN-003:** Administrators must review and approve or reject publisher status requests.
- **RN-004:** Users must be notified of the decision regarding their publisher status request.

## Dependencies

- US-REA-010 must provide authentication.

## Out of Scope
* Automatic approval of publisher status requests
* Editing publisher data after submission
