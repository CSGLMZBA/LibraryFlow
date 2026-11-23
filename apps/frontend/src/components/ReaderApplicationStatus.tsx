
import { useEffect, useState } from "react";
import type {
  PublisherApplication,
  PublisherApplicationStatus,
} from "@library-flow/shared";
import { publisherApplicationService } from "../services/publisher-application-service";

// All application states are defined by the shared Sprint 2 contract.
const statusDetails: Record<
  PublisherApplicationStatus,
  {
    label: string;
    description: string;
    className: string;
  }
> = {
  pending: {
    label: "Pending",
    description: "Your application is awaiting moderator review.",
    className: "bg-amber-100 text-amber-800",
  },
  approved: {
    label: "Approved",
    description: "Your application has been approved.",
    className: "bg-emerald-100 text-emerald-800",
  },
  rejected: {
    label: "Rejected",
    description: "Your application was rejected.",
    className: "bg-rose-100 text-rose-800",
  },
  withdrawn: {
    label: "Withdrawn",
    description: "You withdrew this application.",
    className: "bg-slate-100 text-slate-700",
  },
  expired: {
    label: "Expired",
    description: "Your application expired without approval.",
    className: "bg-slate-100 text-slate-700",
  },
};

type LoadState = "loading" | "ready" | "error";

// Format dates safely without assuming that every value is valid.
function formatDate(value?: string): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

export function ReaderApplicationStatus() {
  const [applications, setApplications] = useState<
    PublisherApplication[]
  >([]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null
  );

  const [reloadKey, setReloadKey] = useState(0);

// Count manual refresh attempts to provide visible feedback.
  const [refreshAttempts, setRefreshAttempts] = useState(0);


// Application withdrawal confirmation and request state.
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const [withdrawalError, setWithdrawalError] = useState<{
    applicationId: string;
    message: string;
  } | null>(null);

  const [withdrawalNotice, setWithdrawalNotice] = useState<string | null>(
    null,
  );

  // Read applications from the existing authenticated API service.
  useEffect(() => {
    let active = true;

    setLoadState("loading");
    setErrorMessage(null);

    void publisherApplicationService
      .listMyApplications()
      .then((result) => {
        if (!active) {
          return;
        }

        if (!result.success) {
          setErrorMessage(result.error.message);
          setLoadState("error");
          return;
        }

        if (!Array.isArray(result.data)) {
          setErrorMessage(
            "The server returned an invalid application list."
          );
          setLoadState("error");
          return;
        }

        // Display the newest application first.
        const ordered = [...result.data].sort((first, second) =>
          second.createdAt.localeCompare(first.createdAt)
        );

        setApplications(ordered);
        setLoadState("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setErrorMessage(
          "An unexpected error occurred while loading your applications."
        );
        setLoadState("error");
      });

    // Ignore responses after this component is unmounted.
    return () => {
      active = false;
    };
  }, [reloadKey]);

    function refreshApplications() {
      if (withdrawingId !== null) {
        return;
      }

      setConfirmationId(null);
      setWithdrawalError(null);
      setWithdrawalNotice(null);

      setRefreshAttempts((previous) => previous + 1);
      setReloadKey((previous) => previous + 1);
    }

    // Withdraw an application only after explicit confirmation.
    async function confirmWithdrawal(application: PublisherApplication) {
      if (
        application.status !== "pending" ||
        withdrawingId !== null ||
        confirmationId !== application.id
      ) {
        return;
      }

      setWithdrawingId(application.id);
      setConfirmationId(null);
      setWithdrawalError(null);
      setWithdrawalNotice(null);

      try {
        const result = await publisherApplicationService.withdrawApplication(
          application.id,
          application.revision,
        );

        if (!result.success) {
          const isConflict =
            result.error.code === "REVISION_CONFLICT" ||
            result.error.code === "INVALID_STATE";

          setWithdrawalError({
            applicationId: application.id,
            message: isConflict
              ? "This application has changed. Refresh its status before trying again."
              : result.error.message,
          });

          return;
        }

        const updatedApplication = result.data;

        // Never display success without a valid withdrawn response.
        if (
          updatedApplication.id !== application.id ||
          updatedApplication.status !== "withdrawn"
        ) {
          setWithdrawalError({
            applicationId: application.id,
            message:
              "The server returned an unexpected result. Refresh the application status.",
          });

          return;
        }

        // Update the view using the confirmed server response.
        setApplications((current) =>
          current.map((item) =>
            item.id === updatedApplication.id
              ? updatedApplication
              : item,
          ),
        );

        setWithdrawalNotice(
          `Application "${updatedApplication.publisherName}" was withdrawn successfully.`,
        );
      } catch {
        setWithdrawalError({
          applicationId: application.id,
          message:
            "An unexpected error occurred. Refresh the application status before trying again.",
        });
      } finally {
        setWithdrawingId(null);
      }
    }

  return (
    <section
      aria-labelledby="reader-application-status-title"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      {/* Page heading and manual refresh */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="reader-application-status-title"
            className="text-xl font-semibold text-slate-900"
          >
            My Publisher Applications
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Review the status of your publisher applications.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshApplications}
          disabled={loadState === "loading" || withdrawingId !== null}
          className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh status
        </button>
      </div>

      {/* Successful withdrawal feedback */}
      {withdrawalNotice && (
        <p
          role="status"
          aria-live="polite"
          className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          {withdrawalNotice}
        </p>
      )}

      {/* Loading state */}
      {loadState === "loading" && (
        <div
          role="status"
          aria-live="polite"
          className="py-8 text-center text-sm text-slate-600"
        >
          Loading your publisher applications...
        </div>
      )}

      {/* Error and retry state */}
      {loadState === "error" && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4"
        >
          <p className="font-medium text-rose-800">
            Unable to load applications
          </p>

          <p className="mt-2 text-sm text-rose-700">
            {errorMessage}
          </p>

          {refreshAttempts > 0 && (
          <p
            role="status"
            aria-live="polite"
            className="mt-2 text-xs font-medium text-rose-700"
            >
             Manual refresh attempts: {refreshAttempts}
          </p>
            )}

          <button
            type="button"
            onClick={refreshApplications}
            className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {loadState === "ready" && applications.length === 0 && (
        <div
          role="status"
          className="py-10 text-center"
        >
          <p className="font-medium text-slate-800">
            No applications found
          </p>

          <p className="mt-2 text-sm text-slate-600">
            You have not submitted a publisher application yet.
            Use Apply as Publisher to submit your first request.
          </p>
        </div>
      )}

      {/* Application list */}
      {loadState === "ready" && applications.length > 0 && (
        <div className="mt-5">
          <p className="mb-4 text-sm text-slate-600">
            {applications.length} application
            {applications.length === 1 ? "" : "s"} found
          </p>

          <ul className="space-y-4">
            {applications.map((application) => {
              const status = statusDetails[application.status];

              return (
                <li
                  key={application.id}
                  className="rounded-xl border border-slate-200 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {application.publisherName}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Application ID: {application.id}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    {status.description}
                  </p>

                  <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-500">
                        Submitted
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {formatDate(application.createdAt)}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500">
                        Last updated
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {formatDate(application.updatedAt)}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500">
                        Expires on
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {formatDate(application.expiresAt)}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500">
                        Revision
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {application.revision}
                      </dd>
                    </div>

                    {application.reviewedAt && (
                      <div>
                        <dt className="font-medium text-slate-500">
                          Reviewed
                        </dt>
                        <dd className="mt-1 text-slate-900">
                          {formatDate(application.reviewedAt)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {application.status === "rejected" &&
                    application.decisionReason && (
                      <div className="mt-5 rounded-lg bg-rose-50 p-3">
                        <p className="text-sm font-semibold text-rose-800">
                          Rejection reason
                        </p>

                        <p className="mt-1 text-sm text-rose-700">
                          {application.decisionReason}
                        </p>
                      </div>
                    )}

                    {/* Withdrawal is available only for pending applications. */}
                    {application.status === "pending" && (
                      <div className="mt-5 border-t border-slate-200 pt-4">
                        {confirmationId === application.id ? (
                          <div
                            role="group"
                            aria-label="Confirm application withdrawal"
                            className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                          >
                            <p className="text-sm font-semibold text-amber-900">
                              Withdraw this application?
                            </p>

                            <p className="mt-2 text-sm text-amber-800">
                              This action will end your pending application.
                              You can submit a new application afterward.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  void confirmWithdrawal(application);
                                }}
                                disabled={withdrawingId !== null}
                                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50"
                              >
                                Confirm withdrawal
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmationId(null)}
                                disabled={withdrawingId !== null}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={withdrawingId !== null}
                            onClick={() => {
                              setWithdrawalError(null);
                              setWithdrawalNotice(null);
                              setConfirmationId(application.id);
                            }}
                            className="rounded-lg border border-rose-600 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {withdrawingId === application.id
                              ? "Withdrawing..."
                              : "Withdraw application"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Withdrawal errors are displayed next to their application. */}
                    {withdrawalError?.applicationId === application.id && (
                      <p
                        role="alert"
                        className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                      >
                        {withdrawalError.message}
                      </p>
                    )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
