import { createContext, useContext, useState, type ReactNode } from "react";
import { authService } from "../services/auth-service";
import type { AuthResult, AuthSession, AuthUser, RegisterRole, UserRole} from "../types/auth";

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult<AuthSession>>;
  register: (
    email: string,
    password: string,
    requestedRole: RegisterRole
  ) => Promise<AuthResult<AuthUser>>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    authService.getCurrentSession()
  );

  const login = async (email: string, password: string): Promise<AuthResult<AuthSession>> => {
    const result = await authService.login(email, password);
    if (result.success) {
      setSession(result.data);
    }
    return result;
  };

  const register = async (
    email: string,
    password: string,
    requestedRole: RegisterRole
  ): Promise<AuthResult<AuthUser>> => {
    return authService.register(email, password, requestedRole);
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setSession(null);
  };

  const hasRole = (role: UserRole): boolean => {
    return session?.user.role === role;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session),
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}