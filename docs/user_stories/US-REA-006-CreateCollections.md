# US-REA-006 – Create collections

## User Story

As a reader, I want to create collections, so that I can organize book series and related books.

## Acceptance Criteria

### CA-001 – Create a collection

Given that the reader is authenticated and provides a valid name  
When they save the collection  
Then it must be created and associated with the reader.

### CA-002 – Add and remove books

Given that a collection exists  
When the reader adds or removes an available book  
Then the collection must reflect the change after saving and reload.

### CA-003 – Protect private collections

Given that a collection belongs to a reader  
When another user tries to modify it  
Then the change must be rejected.

## Business rules

- **RN-001:** Collection names must not be empty.
- **RN-002:** A reader may manage only their own collections.
- **RN-003:** A book may belong to multiple collections.

## Dependencies

- US-REA-010 and US-PUB-006.

## Out of Scope

* Collaborative collections
* Automatic collection generation
* Sharing collection links
