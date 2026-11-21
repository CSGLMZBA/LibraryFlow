export type UserRole = "reader" | "publisher" | "moderator";

export type HealthResponse = {
  status: "ok";
  service: "library-flow-api";
};

export * from "./schemas/limits.js";
export * from "./types/api.js";
export * from "./types/book.js";
export * from "./types/classification.js";
export * from "./types/comment.js";
export * from "./types/notification.js";
export * from "./types/publisher-application.js";
