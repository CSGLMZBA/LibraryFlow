import { useState } from "react";

import CatalogPage from "./pages/CatalogPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { PublisherDashboardPage } from "./pages/PublisherDashboardPage";

function WorkspaceShell() {
  // Obtener la información de autenticación.
  const { user, isAuthenticated, logout } = useAuth();

  // Permite consultar el catálogo como visitante.
  const [showGuestCatalog, setShowGuestCatalog] = useState(false);

  // Permite cambiar entre el catálogo y el panel del publicador.
  const [showPublisherDashboard, setShowPublisherDashboard] =
    useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Encabezado principal */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

          <div>
            <h1 className="text-xl font-bold tracking-tight text-indigo-600">
              LibraryFlow
            </h1>

            <p className="text-xs text-slate-500">
              Sprint 1 — Book Sharing &amp; Discovery
            </p>
          </div>

          {/* Mostrar información al iniciar sesión */}
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

              {/* Botón para cerrar sesión */}
              <button
                type="button"
                onClick={() => {
                  setShowPublisherDashboard(false);
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

      {/* Contenido principal */}
      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* CASO 1: USUARIO NO AUTENTICADO */}
        {!isAuthenticated || !user ? (

          showGuestCatalog ? (

            // Catálogo público para visitantes.
            <div>
              <button
                type="button"
                onClick={() => setShowGuestCatalog(false)}
                className="mb-6 text-sm font-medium text-indigo-600 hover:underline"
              >
                Volver al inicio de sesión
              </button>

              <CatalogPage />
            </div>

          ) : (

            // Mostrar primero la pantalla de login.
            <div>
              <AuthPage />

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowGuestCatalog(true)}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Explorar catálogo sin iniciar sesión
                </button>
              </div>
            </div>

          )

        ) : (

          /* CASO 2: USUARIO AUTENTICADO */
          <div>

            {/* Herramientas exclusivas del publicador */}
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
                             px-4 py-2 font-medium
                             text-white hover:bg-indigo-700"
                >
                  {showPublisherDashboard
                    ? "Volver al catálogo"
                    : "Mis publicaciones"}
                </button>
              </div>
            )}

            {/* Mostrar panel del publicador o catálogo */}
            {user.role === "publisher" &&
            showPublisherDashboard ? (

              <PublisherDashboardPage publisher={user} />

            ) : (

              // Página principal después de iniciar sesión.
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
