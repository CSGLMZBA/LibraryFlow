# US-REA-013 - Request Publisher Status

## User Story

As a reader, I want to request publisher status, so that an administrator can
verify my publishing identity before I receive upload access.

## Acceptance Criteria

### CA-001 - Submit a Publisher Application

Given that I am signed in as a reader
When I submit complete publisher details
Then I receive confirmation
And one pending application is created
And my account remains a reader until a decision is made.

### CA-002 - Validate Publisher Data

Given that I submit a publisher application
When any required value is missing or invalid
Then no application is created
And field-specific validation feedback is displayed.

### CA-003 - Review the Application

Given that an administrator opens pending applications
When they approve or reject an application
Then the application status and reviewer data are persisted
And the applicant receives an in-app notification.

### CA-004 - Prevent Duplicate Applications

Given that I already have a pending or approved application
When I attempt to submit another application
Then the duplicate request is rejected
And the existing status is shown.

### CA-005 - Withdraw a Pending Application

Given that my application is pending
When I withdraw it
Then it becomes `withdrawn`
And I remain a reader.

### CA-006 - Resubmit after Rejection or Withdrawal

Given that my application was rejected or withdrawn
When I submit a new valid application
Then one new pending application is created.

### CA-007 - Expire an Old Pending Application

Given that a pending application remains unresolved for 30 days
When the expiration operation runs
Then the application becomes expired
And the applicant is notified.

## Required Publisher Data

- Publisher name
- Legal representative name
- Independent publisher status
- Publisher email
- Optional website

## Business Rules

- **RN-001:** Public registration never grants publisher status.
- **RN-002:** Only signed-in readers may submit applications.
- **RN-003:** A reader may have at most one active application.
- **RN-004:** Approval requires an administrator and atomic server-side role update.
- **RN-005:** Rejection or withdrawal never grants publisher privileges.
- **RN-006:** Pending applicants may not create books or upload files.
- **RN-007:** Approved publisher status must be revocable.

## Dependencies

- US-REA-010: authentication and role verification
- US-MOD-005: application approval
- US-MOD-007: publisher revocation

## Out of Scope

- Automatic approval
- Public editor or legal verification
- Editing submitted identity data
- Collaborative or organization-owned publisher accounts
