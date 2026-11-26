/**
 * Selects where books and comments live. Local mode (default) keeps them in this browser's IndexedDB;
 * cloud mode uses the backend (Firestore records, private Supabase files). Requires cloud sign-in.
 */
export const CLOUD_CONTENT =
  (import.meta as ImportMeta & { env?: { VITE_CONTENT_MODE?: string } }).env?.VITE_CONTENT_MODE === "cloud";
