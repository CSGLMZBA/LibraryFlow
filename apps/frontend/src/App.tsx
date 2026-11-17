import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";

function WorkspaceShell() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-indigo-600">LibraryFlow</h1>
            <p className="text-xs text-slate-500">Sprint 1 — Book Sharing &amp; Discovery</p>
          </div>

          {isAuthenticated && user && (
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <p className="font-medium text-slate-900">{user.displayName}</p>
                <p className="text-xs capitalize text-slate-500">Role: {user.role}</p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!isAuthenticated ? (
          <AuthPage />
        ) : (
          <section
            aria-labelledby="session-overview-heading"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="session-overview-heading" className="text-lg font-semibold text-slate-900">
              Authenticated Workspace
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Signed in as <span className="font-medium text-slate-900">{user?.email}</span> with
              role <span className="font-medium capitalize text-indigo-600">{user?.role}</span>.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <WorkspaceShell />
    </AuthProvider>
  );
}

export default App;
