# US-MOD-002 – Organize genres

## User Story

As a moderator, I want to organize literary genres, so that the library remains consistent for readers and publishers.

## Acceptance Criteria

### CA-001 – Create a genre

Given that the moderator provides a unique valid genre name  
When they save it  
Then the genre must be available for book classification.

### CA-002 – Update a genre

Given that a genre exists  
When the moderator changes it to a valid unique name  
Then books using the genre must retain their association.

### CA-003 – Prevent duplicates

Given that a genre name already exists  
When the moderator tries to create or rename another genre to that name  
Then the change must be rejected with an explanatory message.

## Business rules

- **RN-001:** Genre names must be unique and non-empty.
- **RN-002:** Only authorized moderators may manage genres.
- **RN-003:** Genre changes must not remove book records.

## Dependencies

- US-MOD-001 and persistent book metadata.

## Out of Scope

* Automatic genre classification
* Book content analysis
* Genre recommendations
