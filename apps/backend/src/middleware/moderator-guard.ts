import { createAuthGuard } from "./auth-guard.js";
import { verifyFirebaseIdentity } from "../services/firebase-auth-service.js";

export const moderatorGuard = createAuthGuard(
  verifyFirebaseIdentity,
  "moderator",
);
