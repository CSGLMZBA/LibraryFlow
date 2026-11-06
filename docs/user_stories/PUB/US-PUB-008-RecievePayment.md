## US-PUB-008 – Receive Payment

## User Story

As a publisher, I want to receive payments for my books, so that I can earn revenue from my content.

## Acceptance Criteria

### CA-001 – Receive payment

Given that a reader has purchased a book  
When the payment is processed successfully  
Then the publishers credit account must be updated with the payment amount

### CA-002 – Payment failure

Given that a reader has purchased a book  
When the payment fails to process  
Then the publisher must not receive any payment.

## Business rules

- **RN-001:** Only authenticated publishers may receive payments for their books.
- **RN-002:** The system must ensure that payments are processed securely and accurately.

## Dependencies
- US-PUB-007 and role-based authorization.
- US-REA-014 must provide the purchase functionality and payment processing.

