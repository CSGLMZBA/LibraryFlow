export type BookStatus = "pending" | "approved" | "rejected" | "deleted";

export type BookFileType = "epub" | "pdf";

export type BookDownloadState =
  | "Not Started"
  | "In Progress"
  | "Completed"
  | "Failed";

export type Book = {
  id: string;
  title: string;
  author: string;
  readonly ownerId: string;
  status: BookStatus;
  accessKey: string;
  shareableUrl: string;
  /** Always an empty string. Book files are reached only through signed URLs (SPEC-002 §4). */
  fileUrl: string;
  /** Object key inside the private book bucket. Not a URL; grants no access (SPEC-002 §4.1). */
  fileObjectPath?: string;
  fileType: BookFileType;
  fileSizeBytes: number;
  categoryIds: string[];
  genreIds: string[];
  rejectionReason?: string;
  rejectionDate?: string;
  scheduledDeletionDate?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type CreateBookDto = {
  title: string;
  author: string;
  fileType: BookFileType;
  fileSizeBytes: number;
  categoryIds: string[];
  genreIds: string[];
};

export type UpdateBookMetadataDto = {
  title?: string;
  author?: string;
  categoryIds?: string[];
  genreIds?: string[];
  clientRevision?: number;
  mutationId?: string;
};

/** POST /books/:id/file/upload-url request (SPEC-002 §4.1). */
export type BookFileUploadUrlRequest = {
  fileName: string;
  fileType: BookFileType;
  fileSizeBytes: number;
  revision: number;
};

/** POST /books/:id/file/upload-url response data. */
export type BookFileUploadUrlResponse = {
  objectPath: string;
  uploadUrl: string;
};

/** POST /books/:id/file/complete request. Response data is the updated Book. */
export type BookFileCompleteRequest = {
  objectPath: string;
  revision: number;
};

/** GET /books/:id/file/download-url response data. */
export type BookFileDownloadUrlResponse = {
  downloadUrl: string;
  expiresAt: string;
};

export type BookFilterQuery = {
  search?: string;
  categoryId?: string;
  genreId?: string;
};

export type RevisionConflictData<T> = {
  resourceId: string;
  serverRevision: number;
  serverValue: T;
};

export type RevisionConflictErrorPayload<T> =
  RevisionConflictData<T>;
