# US-REA-009 – Notify about favorite book updates

## User Story

As a reader, I want to receive notifications when books I marked as favorites are updated, so that I know about new chapters or changes.

## Acceptance Criteria

### CA-001 – Detect a favorite book update

Given that a reader has favorited a book  
When the publisher updates its content or relevant details  
Then an update notification must be created for that reader.

### CA-002 – Identify the updated book

Given that an update notification exists  
When the reader opens it  
Then it must identify the book and summarize that it was updated  
And it must provide a link to the book.

### CA-003 – Notify only interested readers

Given that a book is updated  
When notifications are generated  
Then they must be sent only to readers who favorited that book.

### CA-004 – Avoid duplicate notifications

Given that an update has already generated a notification  
When the same update is processed again  
Then a duplicate notification must not be created.

## Business rules

- **RN-001:** Notifications require an authenticated reader and a persisted favorite.
- **RN-002:** Removing a favorite stops future notifications for that book.
- **RN-003:** Notifications must not expose another reader's data.
- **RN-004:** Each book update may produce at most one notification per interested reader.

## Dependencies

- US-REA-008 must provide favorites.
- US-PUB-004 must provide persisted book updates.
- An in-app notification mechanism must be available.

## Out of Scope

* Email or push notifications
* Recommendations
* Notifications for books that were never favorited
* User-configurable notification schedules
