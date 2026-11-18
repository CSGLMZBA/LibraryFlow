import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '../services/auth-service';
import type { AuthResult, AuthSession, AuthUser, RegisterRole, UserRole } from '../types/auth';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult<AuthSession>>;
  register: (email: string, password: string, requestedRole: RegisterRole) => Promise<AuthResult<AuthUser>>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    void authService.getCurrentSession()
      .then((restored) => { if (mounted) setSession(restored); })
      .catch(() => { if (mounted) setSession(null); })
      .finally(() => { if (mounted) setInitializing(false); });
    return () => { mounted = false; };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult<AuthSession>> => {
    const result = await authService.login(email, password);
    if (result.success) setSession(result.data);
    return result;
  };
  const register = async (email: string, password: string, role: RegisterRole): Promise<AuthResult<AuthUser>> => {
    return authService.register(email, password, role);
  };
  const logout = async () => {
    await authService.logout();
    setSession(null);
  };
  const hasRole = (role: UserRole): boolean => session?.user.role === role;

  if (initializing) return <p role="status">Restoring session...</p>;
  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      login, register, logout, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider.');
  return value;
}