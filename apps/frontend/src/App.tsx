import { useState } from "react";

import CatalogPage from "./pages/CatalogPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { PublisherDashboardPage } from "./pages/PublisherDashboardPage";
import ModeratorDashboardPage from "./pages/ModeratorDashboardPage";
import { PublisherApplicationForm } from "./components/PublisherApplicationForm";

function WorkspaceShell() {
  // Get authentication state.
  const { user, isAuthenticated, logout } = useAuth();

  // Allow visitors to browse the catalog.
  const [showGuestCatalog, setShowGuestCatalog] = useState(false);

  // Switch between the catalog and publisher dashboard.
  const [showPublisherDashboard, setShowPublisherDashboard] =
    useState(false);

  // Switch between the catalog and publisher application form (readers only).
  const [showPublisherApplication, setShowPublisherApplication] =
    useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Main header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

          <div>
            <h1 className="text-xl font-bold tracking-tight text-indigo-600">
              LibraryFlow
            </h1>

            <p className="text-xs text-slate-500">
              Sprint 2 — Book Sharing &amp; Discovery
            </p>
          </div>

          {/* Signed-in account information */}
          {isAuthenticated && user && (
            <div className="flex items-center gap-4">

              <div className="text-right text-sm">
                <p className="font-medium text-slate-900">
                  {user.displayName}
                </p>

                <p className="text-xs capitalize text-slate-500">
                  Role: {user.role}
                </p>
              </div>

              {/* Sign-out button */}
              <button
                type="button"
                onClick={() => {
                  setShowPublisherDashboard(false);
                  setShowPublisherApplication(false);
                  void logout();
                }}
                className="rounded-lg border border-slate-300
                           bg-white px-3 py-1.5 text-sm
                           font-medium text-slate-700
                           hover:bg-slate-100"
              >
                Log out
              </button>

            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* Case 1: unauthenticated user */}
        {!isAuthenticated || !user ? (

          showGuestCatalog ? (

            // Public catalog for visitors.
            <div>
              <button
                type="button"
                onClick={() => setShowGuestCatalog(false)}
                className="mb-6 text-sm font-medium text-indigo-600 hover:underline"
              >
                Back to sign in
              </button>

              <CatalogPage />
            </div>

          ) : (

            // Show the login screen first.
            <div>
              <AuthPage />

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowGuestCatalog(true)}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Browse catalog without signing in
                </button>
              </div>
            </div>

          )

        ) : (

          /* Case 2: authenticated user */
          <div>

            {/* Reader-only publisher application trigger */}
            {user.role === "reader" && (
              <div className="mb-6 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowPublisherApplication((previous) => !previous)
                  }
                  className="rounded-lg bg-indigo-600
                             px-4 py-2 text-sm font-medium
                             text-white hover:bg-indigo-700"
                >
                  {showPublisherApplication
                    ? "Back to catalog"
                    : "Apply as Publisher"}
                </button>
              </div>
            )}

            {/* Publisher-only tools */}
            {user.role === "publisher" && (
              <div className="mb-6 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowPublisherDashboard(
                      (previous) => !previous
                    )
                  }
                  className="rounded-lg bg-indigo-600
                             px-4 py-2 text-sm font-medium
                             text-white hover:bg-indigo-700"
                >
                  {showPublisherDashboard
                    ? "Back to catalog"
                    : "My publications"}
                </button>
              </div>
            )}

            {/* Show moderator, publisher, reader application, or catalog workspace */}
            {user.role === "moderator" ? (
              <ModeratorDashboardPage moderator={user} />
            ) : user.role === "publisher" &&
            showPublisherDashboard ? (
              <PublisherDashboardPage publisher={user} />
            ) : user.role === "reader" &&
            showPublisherApplication ? (
              <PublisherApplicationForm />
            ) : (
              // Main page after sign-in.
              <CatalogPage />
            )}

          </div>
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