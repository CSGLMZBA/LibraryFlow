import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const email = process.argv[2]?.trim() || process.env.MODERATOR_EMAIL?.trim();
if (!email) {
  throw new Error(
    "Set MODERATOR_EMAIL in .env or pass the account email: npm run admin:moderator -- moderator@example.com",
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
let user;

try {
  user = await auth.getUserByEmail(email);
} catch (error) {
  if (error?.code === "auth/user-not-found") {
    throw new Error(
      `Firebase Authentication account not found: ${email}. Create or register the account first.`,
    );
  }
  throw error;
}

await auth.setCustomUserClaims(user.uid, { role: "moderator" });
await auth.revokeRefreshTokens(user.uid);

console.log(`Moderator role assigned to ${email}.`);
console.log("The account must sign out and sign in again to receive a fresh token.");
