import type {
  Book,
  BookComment,
  BookFileCompleteRequest,
  BookFileDownloadUrlResponse,
  BookFileUploadUrlRequest,
  BookFileUploadUrlResponse,
  Category,
  CreateBookDto,
  Genre,
  UpdateBookMetadataDto,
} from "@library-flow/shared";
import { authService } from "./auth-service";

type AuthConsumer = Pick<typeof authService, "getCurrentSession" | "getAccessToken">;
type AuthMode = "required" | "optional";

/** A failed backend call. `data` carries the server value for REVISION_CONFLICT responses. */
export class ContentApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ContentApiError";
  }
}

const configuredBase = ((import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export type Classifications = { categories: Category[]; genres: Genre[] };
export type CatalogFilters = { search?: string; categoryId?: string; genreId?: string };

/** HTTP client for the Sprint 2 book, comment and moderation routes. It never sends identity claims of its own. */
export function createCloudContentApi(
  auth: AuthConsumer = authService,
  apiBase = configuredBase,
  transport: typeof fetch = fetch,
) {
  const base = apiBase.replace(/\/$/, "");

  async function bearer(mode: AuthMode): Promise<string | null> {
    // Revalidates the session so a revoked or expired login is noticed before a write.
    await auth.getCurrentSession();
    const token = auth.getAccessToken();
    if (!token && mode === "required") {
      throw new ContentApiError("AUTH_REQUIRED", "Sign in to use this feature.", 401);
    }
    return token;
  }

  async function request<T>(
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    mode: AuthMode,
    body?: unknown,
  ): Promise<T> {
    const token = await bearer(mode);
    let response: Response;
    try {
      response = await transport(`${base}/api/v1${path}`, {
        method,
        cache: "no-store",
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ContentApiError("SERVICE_UNAVAILABLE", "Cannot reach the LibraryFlow server. Try again.", 0);
    }
    const envelope = await response.json().catch(() => null) as {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
    } | null;
    if (!response.ok || !envelope?.success || envelope.data === undefined) {
      throw new ContentApiError(
        envelope?.error?.code ?? "REQUEST_FAILED",
        envelope?.error?.message ?? "The request could not be completed.",
        response.status,
        envelope?.data,
      );
    }
    return envelope.data;
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    listClassifications: () => request<Classifications>("/classifications", "GET", "optional"),

    listCatalog(filters: CatalogFilters = {}) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      const suffix = query.size > 0 ? `?${query}` : "";
      return request<Book[]>(`/books${suffix}`, "GET", "optional");
    },
    getBook: (bookId: string) => request<Book>(`/books/${id(bookId)}`, "GET", "optional"),
    listMyBooks: () => request<Book[]>("/books/mine", "GET", "required"),
    createBook: (dto: CreateBookDto) => request<Book>("/books", "POST", "required", dto),
    updateBook: (bookId: string, dto: UpdateBookMetadataDto) =>
      request<Book>(`/books/${id(bookId)}`, "PATCH", "required", dto),

    requestUploadUrl: (bookId: string, dto: BookFileUploadUrlRequest) =>
      request<BookFileUploadUrlResponse>(`/books/${id(bookId)}/file/upload-url`, "POST", "required", dto),
    completeUpload: (bookId: string, dto: BookFileCompleteRequest) =>
      request<Book>(`/books/${id(bookId)}/file/complete`, "POST", "required", dto),
    requestDownloadUrl: (bookId: string) =>
      request<BookFileDownloadUrlResponse>(`/books/${id(bookId)}/file/download-url`, "GET", "required"),

    /** Uploads straight to the private storage bucket with the one-time signed URL; no credentials are sent. */
    async uploadToSignedUrl(uploadUrl: string, file: Blob, contentType: string): Promise<void> {
      let response: Response;
      try {
        response = await transport(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      } catch {
        throw new ContentApiError("UPLOAD_FAILED", "The file could not be uploaded. Try again.", 0);
      }
      if (!response.ok) {
        throw new ContentApiError("UPLOAD_FAILED", "The file could not be uploaded. Try again.", response.status);
      }
    },
    /** Reads a signed download URL. Never sends the session token to the storage host. */
    async fetchSignedFile(downloadUrl: string): Promise<Blob> {
      let response: Response;
      try {
        response = await transport(downloadUrl, { method: "GET", cache: "no-store" });
      } catch {
        throw new ContentApiError("DOWNLOAD_FAILED", "The file could not be downloaded. Try again.", 0);
      }
      if (!response.ok) {
        throw new ContentApiError("DOWNLOAD_FAILED", "The file could not be downloaded. Try again.", response.status);
      }
      return response.blob();
    },

    listPendingBooks: () => request<Book[]>("/moderation/books/pending", "GET", "required"),
    approveBook: (bookId: string) =>
      request<Book>(`/moderation/books/${id(bookId)}/approve`, "POST", "required", {}),
    rejectBook: (bookId: string, reason: string) =>
      request<Book>(`/moderation/books/${id(bookId)}/reject`, "POST", "required", { reason }),
    deleteBook: (bookId: string) => request<Book>(`/moderation/books/${id(bookId)}`, "DELETE", "required"),

    listComments: (bookId: string) =>
      request<BookComment[]>(`/books/${id(bookId)}/comments`, "GET", "optional"),
    addComment: (bookId: string, content: string) =>
      request<BookComment>(`/books/${id(bookId)}/comments`, "POST", "required", { content }),
    listModerationComments: () => request<BookComment[]>("/moderation/comments", "GET", "required"),
    removeComment: (commentId: string, reason: string) =>
      request<BookComment>(`/moderation/comments/${id(commentId)}`, "DELETE", "required", { reason }),
  };
}

export type CloudContentApi = ReturnType<typeof createCloudContentApi>;
export const cloudContentApi = createCloudContentApi();
