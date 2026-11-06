## US-REA-016 – Set Details

## User Story
As a reader, I want to set my personal details, so that I can have a personalized experience on the platform.

## Acceptance Criteria

### CA-001 – Set valid personal details
Given that the reader is authenticated and provides optional valid personal details (display name, bio, age, country)  
When they submit their personal details  
Then the details must be stored in persistent storage

### CA-002 – Prevent invalid personal details
Given that the reader submits invalid personal details (e.g, bio is more than 400 characters, display name contains special characters, display name is empty, age is negative, country is not a valid country)  
When they attempt to submit the details
Then the details must not be stored in persistent storage
And the reader must be notified that the personal details are invalid.

### CA-003 – Show personal details
Given that the reader has set their personal details
When they view their profile
Then the personal details must be displayed on their profile page.

### CA-004 – Update personal details
Given that the reader has already set their personal details
When they choose to update their personal details, even removing them
Then the system must allow them to submit new personal details
And the updated personal details must be stored in persistent storage
And the updated personal details must be displayed on their profile page.

### CA-005 – Delete personal details
Given that the reader has already set their personal details
When they choose to delete their personal details
Then the system must remove their personal details from persistent storage
And the personal details must no longer be displayed on their profile page.

### CA-006 - Unique display name
Given that the reader is authenticated and provides a display name
When they submit their personal details
Then the system must ensure that the display name is unique across all users
And if the display name is not unique, the system must notify the reader that the display name is already taken and prompt them to choose a different one.

-- Display Name is required, bio, age, and country are optional. The system must validate the display name to ensure it meets the uniqueness requirement.