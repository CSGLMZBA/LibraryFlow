import { validateLoginInput, validateRegisterInput } from "../schemas/auth-schema";
import type { AuthResult, AuthSession, AuthUser, RegisterRole, UserRole} from "../types/auth";

interface StoredUserRecord extends AuthUser {
  passwordHash: string;
}

const USERS_STORAGE_KEY = "libraryflow_mock_users_v1";
const SESSION_STORAGE_KEY = "libraryflow_mock_session_v1";

// Seeded test moderator per US-REA-010 RN-006 & US-MOD-010 CA-001
const SEEDED_MODERATOR_EMAIL = "moderator@libraryflow.local";
const SEEDED_MODERATOR_PASS = "ModPass123!";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateUniqueDisplayName(email: string, existingUsers: StoredUserRecord[]): string {
  const localPart = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
  let candidate = "";
  let attempts = 0;

  do {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `${localPart}${suffix}`;
    attempts += 1;
  } while (
    existingUsers.some((u) => u.displayName.toLowerCase() === candidate.toLowerCase()) &&
    attempts < 50
  );

  return candidate;
}

async function ensureSeededUsers(): Promise<StoredUserRecord[]> {
  let users: StoredUserRecord[] = [];
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        users = parsed;
      }
    }
  } catch {
    users = [];
  }

  const hasSeededMod = users.some(
    (u) => u.email.toLowerCase() === SEEDED_MODERATOR_EMAIL.toLowerCase()
  );

  if (!hasSeededMod) {
    const modHash = await hashPassword(SEEDED_MODERATOR_PASS);
    users.push({
      id: "mod-seeded-001",
      email: SEEDED_MODERATOR_EMAIL,
      displayName: "moderator1000",
      role: "moderator",
      createdAt: new Date().toISOString(),
      passwordHash: modHash,
    });
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  return users;
}

export const authService = {
  async register(
    email: string,
    password: string,
    requestedRole: RegisterRole
  ): Promise<AuthResult<AuthUser>> {
    const validationErrors = validateRegisterInput(email, password, requestedRole);
    const firstErrorField = Object.keys(validationErrors)[0] as
      | keyof typeof validationErrors
      | undefined;

    if (firstErrorField) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validationErrors[firstErrorField] ?? "Invalid registration data.",
          field: firstErrorField,
        },
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await ensureSeededUsers();

    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return {
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "This email is already registered.",
          field: "email",
        },
      };
    }

    const passwordHash = await hashPassword(password);
    const displayName = generateUniqueDisplayName(normalizedEmail, users);

    const newRecord: StoredUserRecord = {
      id: `usr-${crypto.randomUUID()}`,
      email: normalizedEmail,
      displayName,
      role: requestedRole,
      createdAt: new Date().toISOString(),
      passwordHash,
    };

    users.push(newRecord);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    const { passwordHash: _ignored, ...publicUser } = newRecord;
    return {
      success: true,
      data: publicUser,
      message: `Account created successfully. Your display name is ${publicUser.displayName}.`,
    };
  },

  async login(email: string, password: string): Promise<AuthResult<AuthSession>> {
    const validationErrors = validateLoginInput(email, password);
    const firstErrorField = Object.keys(validationErrors)[0] as
      | keyof typeof validationErrors
      | undefined;

    if (firstErrorField) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validationErrors[firstErrorField] ?? "Invalid credentials format.",
          field: firstErrorField,
        },
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await ensureSeededUsers();
    const matchedUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    const candidateHash = await hashPassword(password);

    // CA-004: Do not reveal whether email or password caused the failure
    if (!matchedUser || matchedUser.passwordHash !== candidateHash) {
      return {
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
          field: "general",
        },
      };
    }

    const { passwordHash: _ignored, ...publicUser } = matchedUser;
    const session: AuthSession = {
      user: publicUser,
      token: `mock-token-${crypto.randomUUID()}`,
      authenticatedAt: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return {
      success: true,
      data: session,
    };
  },

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  getCurrentSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed?.user?.id || !parsed?.user?.role) return null;
      return parsed;
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  },

  hasRole(role: UserRole): boolean {
    const session = this.getCurrentSession();
    return session?.user.role === role;
  },
};