export type UserRole = "reader" | "publisher" | "moderator";

export type HealthResponse = {
  status: "ok";
  service: "library-flow-api";
};
