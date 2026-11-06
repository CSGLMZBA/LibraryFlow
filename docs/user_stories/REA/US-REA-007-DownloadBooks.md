# US-REA-007 – Keep downloaded books available

## User Story

As a reader, I want to download books, so that I have a backup copy available and can consult the content offline.

## Acceptance Criteria

### CA-001 – Start a download

Given that a public book has downloadable content  
When the reader selects the download action  
Then the book file must be saved to the device  
And progress or completion status must be shown.

### CA-002 – Access a saved copy offline

Given that the download completed successfully  
When the reader opens the book without a network connection  
Then the saved copy must be readable.

### CA-003 – Retry an interrupted download

Given that a download is interrupted  
When the reader retries it  
Then the system must resume or safely restart the transfer  
And it must not report an incomplete file as complete.

### CA-004 – Report unavailable downloads

Given that the book file is unavailable  
When the reader requests a download  
Then the request must fail clearly  
And no invalid local copy must be created.

## Business rules

- **RN-001:** Only publicly available book files may be downloaded.
- **RN-002:** A download must preserve the identity of the published book.
- **RN-003:** Downloaded copies are private to the reader's device.
- **RN-004:** Download failures must not corrupt an existing completed copy.

## Dependencies

- US-PUB-001 must provide published book content.
- Device storage and offline reading must be available.

## Out of Scope

* Payments and purchase validation
* Cross-device synchronization
* Digital rights management
* Sharing downloaded files
