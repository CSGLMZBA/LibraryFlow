export type UserRole = "reader" | "publisher" | "moderator";

export type RegisterRole = Extract<UserRole, "reader" | "publisher">;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  authenticatedAt: string;
}

export interface AuthValidationErrors {
  email?: string;
  password?: string;
  role?: string;
  general?: string;
}

export type AuthResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: { code: string; message: string; field?: keyof AuthValidationErrors } };
  