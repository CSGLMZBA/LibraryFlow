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
