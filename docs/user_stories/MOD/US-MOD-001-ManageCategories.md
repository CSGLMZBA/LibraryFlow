# US-MOD-001 – Manage categories

## User Story

As a moderator, I want to create, edit, and organize the platform's categories, so that readers can classify and find books easily.

## Acceptance Criteria

### CA-001 – Create a category

Given that the moderator provides a unique valid name  
When they save the category  
Then it must be created and available for book classification.

### CA-002 – Update a category

Given that a category exists  
When the moderator changes its name to a valid unique value  
Then the category must be updated without losing its assigned books.

### CA-003 – Reject invalid categories

Given that the name is empty or already exists  
When the moderator saves it  
Then the category must not be created or updated  
And the reason must be displayed.

## Business rules

- **RN-001:** Category names must be unique and non-empty.
- **RN-002:** Only authorized moderators may manage categories.
- **RN-003:** Removing a category must not silently delete books.

## Dependencies

- Role-based authentication and book persistence.

## Out of Scope

* Category analytics
* Automatic category assignment
* Deleting books

