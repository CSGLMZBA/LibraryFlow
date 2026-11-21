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
  fileUrl: string;
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
