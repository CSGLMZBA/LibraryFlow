import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uid = process.argv[2]?.trim() || process.env.MODERATOR_UID?.trim();
if (!uid) {
  throw new Error(
    "Set MODERATOR_UID in .env or pass the existing Firebase UID: npm run admin:moderator -- FIREBASE_UID",
  );
}

const projectId = requireEnvironment("FIREBASE_PROJECT_ID");
const clientEmail = requireEnvironment("FIREBASE_CLIENT_EMAIL");
const privateKey = requireEnvironment("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const auth = getAuth();
try {
  await auth.getUser(uid);
} catch (error) {
  if (error?.code === "auth/user-not-found") {
    throw new Error(
      `Firebase Authentication account not found for UID: ${uid}. Register the account first.`,
    );
  }
  throw error;
}

await auth.setCustomUserClaims(uid, { role: "moderator" });
await auth.revokeRefreshTokens(uid);

console.log(`Moderator role assigned to Firebase UID ${uid}.`);
console.log("The account must sign out and sign in again to receive a fresh token.");
