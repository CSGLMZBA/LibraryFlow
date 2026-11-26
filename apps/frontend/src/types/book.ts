export type BookModerationStatus = "pending-approval" | "approved" | "rejected";

export type AllowedBookFileFormat = "pdf" | "epub";

export interface BookCategory {
  id: string;
  name: string;
}

export interface BookGenre {
  id: string;
  name: string;
  /** Empty when the genre applies to every category (cloud classifications). */
  categoryId: string;
}

export interface BookRecord {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  author: string;
  description: string;
  categoryId: string;
  genreId: string;
  fileName: string;
  fileFormat: AllowedBookFileFormat;
  fileSizeBytes: number;
  accessKey: string;
  status: BookModerationStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  /** Server revision, present only for cloud records; sent back to detect conflicting edits. */
  revision?: number;
}

export interface StoredBookEntry extends BookRecord {
  fileBlob: Blob;
}

export interface CreateBookInput {
  title: string;
  author: string;
  description: string;
  categoryId: string;
  genreId: string;
  file: File | null;
}

export interface UpdateBookInput {
  title: string;
  author: string;
  description: string;
  categoryId: string;
  genreId: string;
  /** The revision the editor was looking at (cloud mode). */
  revision?: number;
}

export interface BookValidationErrors {
  title?: string;
  author?: string;
  description?: string;
  categoryId?: string;
  genreId?: string;
  file?: string;
  general?: string;
}

export type BookOperationResult<T> =
  | { success: true; data: T; message?: string }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        field?: keyof BookValidationErrors;
      };
    };