/**
 * Private book file storage on Supabase Storage (SPEC-002 §4 and §4.1, S2-T07).
 *
 * Talks to the Supabase Storage REST API with `fetch`, so no SDK dependency is
 * needed. The service-role key is sent only in request headers to Supabase and
 * is never returned, logged, or embedded in a URL given to the browser.
 */

export type StoredObjectInfo = {
  sizeBytes: number;
  mimeType: string;
};

/** Operations the book file routes need from the storage provider. */
export interface BookFileStorage {
  /** Signed upload URL for one new object. It cannot overwrite an existing object. */
  createSignedUploadUrl(objectPath: string): Promise<string>;
  /** Metadata of a stored object, or null when it does not exist. */
  getObjectInfo(objectPath: string): Promise<StoredObjectInfo | null>;
  /** Signed download URL for one object, valid for `expiresInSeconds`. */
  createSignedDownloadUrl(
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string>;
  deleteObject(objectPath: string): Promise<void>;
}

/** The storage provider failed or is not configured. Carries no URL or secret. */
export class StorageUnavailableError extends Error {
  public readonly operation: string;
  public readonly status: number | undefined;

  public constructor(operation: string, status?: number) {
    super(
      status === undefined
        ? `Book file storage is unavailable (${operation}).`
        : `Book file storage failed (${operation}, HTTP ${status}).`,
    );
    this.name = "StorageUnavailableError";
    this.operation = operation;
    this.status = status;
  }
}

export type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export const DEFAULT_SUPABASE_BOOK_BUCKET = "books";

type FetchFunction = typeof fetch;

function encodePath(objectPath: string): string {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

export class SupabaseBookFileStorage implements BookFileStorage {
  private readonly storageUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;
  private readonly fetchImpl: FetchFunction;

  public constructor(config: SupabaseStorageConfig, fetchImpl: FetchFunction = fetch) {
    this.storageUrl = `${config.url.replace(/\/+$/, "")}/storage/v1`;
    this.serviceRoleKey = config.serviceRoleKey;
    this.bucket = config.bucket;
    this.fetchImpl = fetchImpl;
  }

  async createSignedUploadUrl(objectPath: string): Promise<string> {
    const body = await this.request<{ url?: string }>(
      "create-upload-url",
      `/object/upload/sign/${encodeURIComponent(this.bucket)}/${encodePath(objectPath)}`,
      { method: "POST", body: JSON.stringify({}) },
    );
    if (typeof body.url !== "string" || !body.url.includes("token=")) {
      throw new StorageUnavailableError("create-upload-url");
    }
    return `${this.storageUrl}${body.url}`;
  }

  async getObjectInfo(objectPath: string): Promise<StoredObjectInfo | null> {
    const separator = objectPath.lastIndexOf("/");
    const prefix = objectPath.slice(0, separator);
    const name = objectPath.slice(separator + 1);

    const entries = await this.request<unknown>(
      "read-object",
      `/object/list/${encodeURIComponent(this.bucket)}`,
      {
        method: "POST",
        body: JSON.stringify({ prefix, search: name, limit: 100, offset: 0 }),
      },
    );
    if (!Array.isArray(entries)) {
      throw new StorageUnavailableError("read-object");
    }

    const entry = entries.find(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        (item as { name?: unknown }).name === name,
    ) as { metadata?: { size?: unknown; mimetype?: unknown } } | undefined;
    if (!entry) {
      return null;
    }

    const size = entry.metadata?.size;
    const mimeType = entry.metadata?.mimetype;
    if (typeof size !== "number" || typeof mimeType !== "string") {
      throw new StorageUnavailableError("read-object");
    }
    return { sizeBytes: size, mimeType };
  }

  async createSignedDownloadUrl(
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const body = await this.request<{ signedURL?: string }>(
      "create-download-url",
      `/object/sign/${encodeURIComponent(this.bucket)}/${encodePath(objectPath)}`,
      { method: "POST", body: JSON.stringify({ expiresIn: expiresInSeconds }) },
    );
    if (typeof body.signedURL !== "string" || !body.signedURL.includes("token=")) {
      throw new StorageUnavailableError("create-download-url");
    }
    return `${this.storageUrl}${body.signedURL}`;
  }

  async deleteObject(objectPath: string): Promise<void> {
    await this.request<unknown>(
      "delete-object",
      `/object/${encodeURIComponent(this.bucket)}`,
      { method: "DELETE", body: JSON.stringify({ prefixes: [objectPath] }) },
    );
  }

  private async request<T>(
    operation: string,
    path: string,
    init: { method: string; body?: string },
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.storageUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey,
          "Content-Type": "application/json",
        },
        ...(init.body === undefined ? {} : { body: init.body }),
      });
    } catch {
      throw new StorageUnavailableError(operation);
    }

    if (!response.ok) {
      throw new StorageUnavailableError(operation, response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new StorageUnavailableError(operation, response.status);
    }
  }
}

/**
 * Builds Supabase storage from environment variables. Returns null when
 * neither SUPABASE_URL nor SUPABASE_SERVICE_ROLE_KEY is set (local mode; the
 * file routes then answer with a storage error). The contract's canonical
 * bucket is used unless SUPABASE_BOOK_BUCKET overrides it. Partial URL/key
 * configuration throws so production never silently disables storage.
 */
export function createBookFileStorageFromEnv(
  env: Record<string, string | undefined> = process.env,
): BookFileStorage | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = env.SUPABASE_BOOK_BUCKET?.trim() || DEFAULT_SUPABASE_BOOK_BUCKET;

  if (!url && !serviceRoleKey) {
    return null;
  }

  if (!url || !serviceRoleKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(
      `Book file storage is partially configured. Missing: ${missing.join(", ")}.`,
    );
  }

  return new SupabaseBookFileStorage({
    url,
    serviceRoleKey,
    bucket,
  });
}
