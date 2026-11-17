export type UserRole = 'reader' | 'publisher' | 'moderator';
export type PublicRegisterRole = Exclude<UserRole, 'moderator'>;
export interface AuthUser { id: string; email: string; displayName: string; role: UserRole; createdAt: string }
export interface AuthSession { user: AuthUser; authenticatedAt: string }
export interface AuthPort {
  register(email: string, password: string, requestedRole: PublicRegisterRole): Promise<AuthSession>;
  login(email: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  hasRole(role: UserRole): Promise<boolean>;
}
export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly field?: string) { super(message); this.name = 'AuthError'; }
}
