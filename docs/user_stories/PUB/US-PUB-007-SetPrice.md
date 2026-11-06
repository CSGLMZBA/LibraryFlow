## US-PUB-007 – Set Price

## User Story

As a publisher, I want to set a price for my books, so that I can monetize my content and earn revenue from readers.

## Acceptance Criteria

### CA-001 – Set a valid price

Given that the publisher is authenticated and provides a valid price (greater than or equal to $0.00)  
When they submit the price for their book  
Then the price must be stored in persistent storage  
And the price must be displayed to readers when they view the book.

### CA-002 – Prevent invalid price

Given that the publisher submits a price that is negative or not a valid number  
When they attempt to submit the price  
Then the price must not be stored in persistent storage  
And the publisher must be notified that the price is invalid.

## Business rules

- **RN-001:** Only authenticated publishers may set prices for their books.
- **RN-002:** Prices must be non-negative numbers.
- **RN-003:** Prices must be in a valid currency format (Dollars only now).

## Dependencies

- US-PUB-001 and persistent book metadata.
