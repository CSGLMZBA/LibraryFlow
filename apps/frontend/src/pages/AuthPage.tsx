import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { validateLoginInput, validateRegisterInput } from "../schemas/auth-schema";
import { accountLifecycleService } from "../services/account-lifecycle-service";
import { seedLocalModeratorForTests } from "../services/auth-service";
import type { AuthValidationErrors, RegisterRole } from "../types/auth";

type AuthMode = "login" | "register";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RegisterRole>("reader");

  const [errors, setErrors] = useState<AuthValidationErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [requestingRecovery, setRequestingRecovery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeedingModerator, setIsSeedingModerator] = useState(false);

  const seedModerator = async () => {
    setErrors({});
    setStatusMessage(null);
    setIsSeedingModerator(true);
    try {
      await seedLocalModeratorForTests(password || "Sprint1Moderator!");
      setEmail("moderator@libraryflow.local");
      setMode("login");
      setStatusMessage(
        "Seeded local moderator created. Use the same password entered below to sign in."
      );
    } catch (error) {
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : "Could not create the seeded moderator.",
      });
    } finally {
      setIsSeedingModerator(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setRecoveryAvailable(false);
    setErrors({});
    setStatusMessage(null);
    setPassword("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setStatusMessage(null);

    const clientErrors =
      mode === "login"
        ? validateLoginInput(email, password)
        : validateRegisterInput(email, password, role);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setRecoveryAvailable(false);
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        const result = await register(email, password, role);
        if (!result.success) {
          const field = result.error.field ?? "general";
          setErrors({ [field]: result.error.message });
          setRecoveryAvailable(result.error.recoveryAvailable === true);
          return;
        }
        setStatusMessage(
          result.message ?? "Registration successful. You can now log in."
        );
        setPassword("");
        setMode("login");
      } else {
        const result = await login(email, password);
        if (!result.success) {
          const field = result.error.field ?? "general";
          setErrors({ [field]: result.error.message });
          setRecoveryAvailable(result.error.recoveryAvailable === true);
          return;
        }
        setStatusMessage(`Welcome back, ${result.data.user.displayName}.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestRecovery = async () => {
    setRequestingRecovery(true);
    setStatusMessage(null);
    try {
      await accountLifecycleService.requestCancellation(email, password);
      setErrors({});
      setRecoveryAvailable(false);
      setPassword('');
      setStatusMessage('Your request is pending moderator approval. You cannot sign in until it is approved.');
    } catch (error) {
      setErrors({general: error instanceof Error ? error.message : 'Could not submit your recovery request. Try again.'});
    } finally { setRequestingRecovery(false); }
  };

  return (
    <section
      aria-labelledby="auth-heading"
      className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => switchMode("login")}
          className={`w-1/2 rounded-md py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            mode === "login"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => switchMode("register")}
          className={`w-1/2 rounded-md py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            mode === "register"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Register
        </button>
      </div>

      <h2 id="auth-heading" className="text-xl font-semibold text-slate-900">
        {mode === "login" ? "Sign in to LibraryFlow" : "Create a LibraryFlow account"}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {mode === "login"
          ? "Enter your credentials to access your authorized workspace."
          : "Register as a reader or publisher to get started."}
      </p>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {statusMessage}
        </div>
      )}

      {errors.general && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <div>
          <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={50}
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setRecoveryAvailable(false); }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "auth-email-error" : undefined}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p id="auth-email-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => { setPassword(e.target.value); setRecoveryAvailable(false); }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? "auth-password-error"
                : mode === "register"
                  ? "auth-password-hint"
                  : undefined
            }
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="••••••••"
          />
          {mode === "register" && !errors.password && (
            <p id="auth-password-hint" className="mt-1 text-xs text-slate-500">
              8–128 characters with uppercase, lowercase, number, and special character.
            </p>
          )}
          {errors.password && (
            <p id="auth-password-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.password}
            </p>
          )}
        </div>

        {mode === "register" && (
          <div>
            <label htmlFor="auth-role" className="block text-sm font-medium text-slate-700">
              Account role
            </label>
            <select
              id="auth-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as RegisterRole)}
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? "auth-role-error" : undefined}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="reader">Reader (Browse, comment, download offline)</option>
              <option value="publisher">Publisher (Publish and manage books)</option>
            </select>
            {errors.role && (
              <p id="auth-role-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.role}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || requestingRecovery}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Processing..."
            : mode === "login"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>
      {mode === 'login' && recoveryAvailable && (
        <div className="mt-4 rounded-lg border border-amber-300 p-3">
          <p className="mb-3 text-sm">Your account remains blocked. You can ask a moderator to cancel its deletion.</p>
          <button type="button" onClick={() => void requestRecovery()} disabled={requestingRecovery || isSubmitting}
            className="w-full rounded-md border border-indigo-600 px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60">
            {requestingRecovery ? 'Submitting request...' : 'Request deletion cancellation'}
          </button>
        </div>
      )}
      {(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => void seedModerator()}
            disabled={isSeedingModerator}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
          >
            {isSeedingModerator ? "Creating test moderator..." : "Create / reset local test moderator"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Development only. Enter a valid password above; the seeded moderator account uses
            moderator@libraryflow.local.
          </p>
        </div>
      )}
    </section>
  );
}