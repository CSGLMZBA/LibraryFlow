export type UserRole = 'reader' | 'publisher' | 'moderator';
export type PublicRegisterRole = Exclude<UserRole, 'moderator'>;
export interface AuthUser { id: string; email: string; displayName: string; role: UserRole; createdAt: string }
export interface AuthSession { user: AuthUser; authenticatedAt: string; lastActivityAt?: string }
export interface AuthPort {
  register(email: string, password: string, requestedRole: PublicRegisterRole): Promise<AuthSession>;
  login(email: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession | null>;
  getAccessToken(): string | null;
  hasRole(role: UserRole): Promise<boolean>;
  getAccessToken?(): string | null;
}
export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly field?: string, public readonly recoveryAvailable = false) { super(message); this.name = 'AuthError'; }
}

// Compatibility types for the Sprint 1 authentication UI in develop.
export type RegisterRole = PublicRegisterRole;
export interface AuthValidationErrors {
  email?: string;
  password?: string;
  role?: string;
  general?: string;
}
export type AuthResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: { code: string; message: string; field?: keyof AuthValidationErrors; recoveryAvailable?: boolean } };
