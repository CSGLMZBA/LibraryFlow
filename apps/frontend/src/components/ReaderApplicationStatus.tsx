
import { useEffect, useState } from "react";

import type {
  PublisherApplication,
  PublisherApplicationStatus,
} from "@library-flow/shared";

import { publisherApplicationService } from "../services/publisher-application-service";

import {
  getReaderApplicationCache,
  saveReaderApplicationCache,
  type CachedReaderApplication,
} from "../services/reader-application-cache";

// Application statuses defined by the shared Sprint 2 contract.
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

type DisplayApplication =
  | PublisherApplication
  | CachedReaderApplication;

interface ReaderApplicationStatusProps {
  userId: string;
}

// Format dates safely.
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

export function ReaderApplicationStatus({
  userId,
}: ReaderApplicationStatusProps) {
  // Current applications returned by the authenticated API.
  const [applications, setApplications] = useState<
    PublisherApplication[]
  >([]);

  // Minimal, read-only applications retrieved from IndexedDB.
  const [cachedApplications, setCachedApplications] = useState<
    CachedReaderApplication[]
  >([]);

  // Identify whether the screen is displaying saved information.
  const [showCached, setShowCached] = useState(false);

  const [cacheSavedAt, setCacheSavedAt] = useState<
    string | null
  >(null);

  const [loadState, setLoadState] = useState<LoadState>(
    "loading",
  );

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  // Manual refresh state.
  const [reloadKey, setReloadKey] = useState(0);

  const [refreshAttempts, setRefreshAttempts] = useState(0);

  // Withdrawal confirmation and request state.
  const [confirmationId, setConfirmationId] = useState<
    string | null
  >(null);

  const [withdrawingId, setWithdrawingId] = useState<
    string | null
  >(null);

  const [withdrawalError, setWithdrawalError] = useState<{
    applicationId: string;
    message: string;
  } | null>(null);

  const [withdrawalNotice, setWithdrawalNotice] = useState<
    string | null
  >(null);

  // Select the correct source of information.
  const displayedApplications: DisplayApplication[] =
    showCached ? cachedApplications : applications;

  // Load applications from the API or a saved offline snapshot.
  useEffect(() => {
    let active = true;

    setLoadState("loading");
    setErrorMessage(null);

    setShowCached(false);
    setCachedApplications([]);
    setCacheSavedAt(null);
    setApplications([]);

    setConfirmationId(null);
    setWithdrawalError(null);

    async function loadApplications() {
      const result =
        await publisherApplicationService.listMyApplications();

      if (!active) {
        return;
      }

      // Handle unsuccessful API responses.
      if (!result.success) {
        // Cached information is only available when the
        // API cannot be reached. Authentication errors
        // must never expose previously saved information.
        if (result.error.code === "SERVICE_UNAVAILABLE") {
          const snapshot =
            await getReaderApplicationCache(userId);

          if (!active) {
            return;
          }

          if (snapshot) {
            const ordered = [...snapshot.applications].sort(
              (first, second) =>
                second.createdAt.localeCompare(
                  first.createdAt,
                ),
            );

            setCachedApplications(ordered);
            setCacheSavedAt(snapshot.savedAt);
            setShowCached(true);

            setErrorMessage(result.error.message);
            setLoadState("ready");

            return;
          }
        }

        setErrorMessage(result.error.message);
        setLoadState("error");

        return;
      }

      // Validate the server response before displaying
      // or storing application information.
      if (
        !Array.isArray(result.data) ||
        result.data.some(
          (application) =>
            application.applicantUid !== userId,
        )
      ) {
        setErrorMessage(
          "The server returned an invalid application list.",
        );

        setLoadState("error");

        return;
      }

      // Display newest applications first.
      const ordered = [...result.data].sort(
        (first, second) =>
          second.createdAt.localeCompare(
            first.createdAt,
          ),
      );

      // Display current server information.
      setApplications(ordered);
      setShowCached(false);
      setLoadState("ready");

      // Save only the minimal application status fields.
      // The cache service excludes private form details.
      void saveReaderApplicationCache(userId, ordered);
    }

    void loadApplications().catch(() => {
      if (!active) {
        return;
      }

      setErrorMessage(
        "An unexpected error occurred while loading your applications.",
      );

      setLoadState("error");
    });

    // Ignore responses after unmounting or changing users.
    return () => {
      active = false;
    };
  }, [reloadKey, userId]);

  // Retry the API request.
  function refreshApplications() {
    if (
      withdrawingId !== null ||
      loadState === "loading"
    ) {
      return;
    }

    setConfirmationId(null);
    setWithdrawalError(null);
    setWithdrawalNotice(null);

    setRefreshAttempts((previous) => previous + 1);
    setReloadKey((previous) => previous + 1);
  }

  // Withdraw only a current, server-verified pending application.
  async function confirmWithdrawal(
    application: PublisherApplication,
  ) {
    if (
      showCached ||
      loadState !== "ready" ||
      application.status !== "pending" ||
      application.applicantUid !== userId ||
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
      const result =
        await publisherApplicationService.withdrawApplication(
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

      // Accept only the expected server-confirmed result.
      if (
        !updatedApplication ||
        updatedApplication.id !== application.id ||
        updatedApplication.applicantUid !== userId ||
        updatedApplication.status !== "withdrawn"
      ) {
        setWithdrawalError({
          applicationId: application.id,
          message:
            "The server returned an unexpected result. Refresh the application status.",
        });

        return;
      }

      // Update the current application list.
      const updatedApplications = applications.map(
        (item) =>
          item.id === updatedApplication.id
            ? updatedApplication
            : item,
      );

      setApplications(updatedApplications);

      // Update the saved snapshot after server confirmation.
      void saveReaderApplicationCache(
        userId,
        updatedApplications,
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
      {/* Page heading and refresh button */}
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
          disabled={
            loadState === "loading" ||
            withdrawingId !== null
          }
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

      {/* Offline snapshot warning */}
      {loadState === "ready" && showCached && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <p className="font-semibold text-amber-900">
            Showing saved application statuses
          </p>

          <p className="mt-2 text-sm text-amber-800">
            The server is currently unavailable.
            This information may be outdated.
          </p>

          <p className="mt-2 text-xs text-amber-800">
            Last saved: {formatDate(cacheSavedAt ?? undefined)}
          </p>

          <p className="mt-2 text-sm text-amber-800">
            Application withdrawal is disabled while
            viewing saved information.
          </p>

          <p className="mt-2 text-sm text-amber-800">
            Select Refresh status to reconnect.
          </p>
        </div>
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
      {loadState === "ready" &&
        displayedApplications.length === 0 && (
          <div
            role="status"
            className="py-10 text-center"
          >
            <p className="font-medium text-slate-800">
              No applications found
            </p>

            <p className="mt-2 text-sm text-slate-600">
              {showCached
                ? "No applications were included in your last saved snapshot."
                : "You have not submitted a publisher application yet. Use Apply as Publisher to submit your first request."}
            </p>
          </div>
        )}

      {/* Application list */}
      {loadState === "ready" &&
        displayedApplications.length > 0 && (
          <div className="mt-5">
            <p className="mb-4 text-sm text-slate-600">
              {displayedApplications.length} application
              {displayedApplications.length === 1
                ? ""
                : "s"}{" "}
              found
            </p>

            <ul className="space-y-4">
              {displayedApplications.map((application) => {
                const status =
                  statusDetails[application.status];

                return (
                  <li
                    key={application.id}
                    className="rounded-xl border border-slate-200 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {"publisherName" in application
                            ? application.publisherName
                            : `Application ${application.id}`}
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

                      {"reviewedAt" in application &&
                        application.reviewedAt && (
                          <div>
                            <dt className="font-medium text-slate-500">
                              Reviewed
                            </dt>

                            <dd className="mt-1 text-slate-900">
                              {formatDate(
                                application.reviewedAt,
                              )}
                            </dd>
                          </div>
                        )}
                    </dl>

                    {/* Rejection details, when available */}
                    {application.status === "rejected" &&
                      "decisionReason" in application &&
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

                    {/* Withdrawal is unavailable in offline mode */}
                    {!showCached &&
                      "applicantUid" in application &&
                      application.status === "pending" && (
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
                                This action will end your
                                pending application.
                                You can submit a new
                                application afterward.
                              </p>

                              <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  disabled={
                                    withdrawingId !== null
                                  }
                                  onClick={() => {
                                    void confirmWithdrawal(
                                      application,
                                    );
                                  }}
                                  className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Confirm withdrawal
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    withdrawingId !== null
                                  }
                                  onClick={() =>
                                    setConfirmationId(null)
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                withdrawingId !== null
                              }
                              onClick={() => {
                                setWithdrawalError(null);
                                setWithdrawalNotice(null);
                                setConfirmationId(
                                  application.id,
                                );
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

                    {/* Withdrawal errors */}
                    {withdrawalError?.applicationId ===
                      application.id && (
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
