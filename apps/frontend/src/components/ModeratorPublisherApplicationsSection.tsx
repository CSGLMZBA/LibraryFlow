import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  REJECTION_REASON_MAX_LENGTH,
  type PublisherApplication,
} from "@library-flow/shared";
import { publisherApplicationService } from "../services/publisher-application-service";

export function ModeratorPublisherApplicationsSection() {
  const [applications, setApplications] = useState<PublisherApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reasonByApplication, setReasonByApplication] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Publisher revocation state (US-MOD-007)
  const [revokeUid, setRevokeUid] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPendingApplications = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await publisherApplicationService.listPendingApplications();
    if (!result.success) {
      setLoadError(result.error.message);
      setLoading(false);
      return;
    }
    setApplications(
      [...result.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPendingApplications();
  }, [loadPendingApplications]);

  async function handleApprove(application: PublisherApplication) {
    setStatusMessage(null);
    setActionError(null);
    setProcessingId(application.id);

    try {
      const result = await publisherApplicationService.approveApplication(
        application.id,
        application.revision,
      );

      if (!result.success) {
        if (
          result.error.code === "REVISION_CONFLICT" ||
          result.error.code === "INVALID_STATE"
        ) {
          setActionError(
            `${result.error.message} Reloading latest application state from server.`,
          );
          await loadPendingApplications();
        } else {
          setActionError(result.error.message);
        }
        return;
      }

      setStatusMessage(
        `Approved "${application.publisherName}". The applicant now has publisher privileges.`,
      );
      await loadPendingApplications();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(
    event: FormEvent<HTMLFormElement>,
    application: PublisherApplication,
  ) {
    event.preventDefault();
    setStatusMessage(null);
    setActionError(null);

    const reason = (reasonByApplication[application.id] ?? "").trim();
    if (!reason || reason.length > REJECTION_REASON_MAX_LENGTH) {
      setActionError(
        `Rejection reason is required and must contain 1-${REJECTION_REASON_MAX_LENGTH} characters.`,
      );
      return;
    }

    setProcessingId(application.id);
    try {
      const result = await publisherApplicationService.rejectApplication(
        application.id,
        application.revision,
        reason,
      );

      if (!result.success) {
        if (
          result.error.code === "REVISION_CONFLICT" ||
          result.error.code === "INVALID_STATE"
        ) {
          setActionError(
            `${result.error.message} Reloading latest application state from server.`,
          );
          await loadPendingApplications();
        } else {
          setActionError(result.error.message);
        }
        return;
      }

      setReasonByApplication((previous) => ({ ...previous, [application.id]: "" }));
      setStatusMessage(
        `Rejected "${application.publisherName}". The applicant remains a reader and was notified.`,
      );
      await loadPendingApplications();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRevokePublisher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setActionError(null);

    const trimmedUid = revokeUid.trim();
    const trimmedReason = revokeReason.trim();

    if (!trimmedUid) {
      setActionError("Publisher UID is required to revoke publisher privileges.");
      return;
    }
    if (!trimmedReason || trimmedReason.length > REJECTION_REASON_MAX_LENGTH) {
      setActionError(
        `Revocation reason is required and must contain 1-${REJECTION_REASON_MAX_LENGTH} characters.`,
      );
      return;
    }

    setRevoking(true);
    try {
      const result = await publisherApplicationService.revokePublisher(
        trimmedUid,
        trimmedReason,
      );
      if (!result.success) {
        setActionError(result.error.message);
        return;
      }

      setRevokeUid("");
      setRevokeReason("");
      setStatusMessage(
        `Revoked publisher privileges for UID "${result.data.uid}". Role reverted to reader.`,
      );
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Pending Publisher Applications Review (US-MOD-005) */}
      <section
        aria-labelledby="pending-applications-heading"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3
              id="pending-applications-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Pending publisher applications
            </h3>
            <p className="text-sm text-slate-600">
              Review applicant details before granting publisher privileges.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPendingApplications()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        {statusMessage && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {statusMessage}
          </p>
        )}

        {actionError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {actionError}
          </p>
        )}

        {loading ? (
          <p role="status" className="mt-4 text-sm text-slate-500">
            Loading pending publisher applications...
          </p>
        ) : loadError ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadPendingApplications()}
              className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Retry
            </button>
          </div>
        ) : applications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No pending publisher applications.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {applications.map((application) => {
              const isBusy = processingId === application.id;
              return (
                <li key={application.id} className="py-5 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {application.publisherName}
                      </h4>
                      <p className="text-sm text-slate-600">
                        Legal representative: {application.legalRepresentativeName} ·{" "}
                        {application.independentPublisher
                          ? "Independent publisher"
                          : "Organization / Press"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Contact: {application.publisherEmail}
                        {application.website ? ` · Website: ${application.website}` : ""} ·
                        Applicant UID: {application.applicantUid} · Expires:{" "}
                        {new Date(application.expiresAt).toLocaleDateString()} · Revision:{" "}
                        {application.revision}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-amber-800">
                      {application.status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleApprove(application)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Processing..." : "Approve Publisher"}
                    </button>

                    <form
                      onSubmit={(event) => void handleReject(event, application)}
                      className="flex flex-1 flex-wrap items-end gap-2"
                    >
                      <label className="min-w-64 flex-1 text-sm text-slate-700">
                        Rejection reason <span className="text-rose-600">*</span>
                        <input
                          type="text"
                          required
                          disabled={isBusy}
                          value={reasonByApplication[application.id] ?? ""}
                          onChange={(event) =>
                            setReasonByApplication((previous) => ({
                              ...previous,
                              [application.id]: event.target.value,
                            }))
                          }
                          maxLength={REJECTION_REASON_MAX_LENGTH}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Explain why this publisher application was rejected"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Revoke Publisher Privileges (US-MOD-007) */}
      <section
        aria-labelledby="revoke-publisher-heading"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <h3
          id="revoke-publisher-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Revoke publisher status
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Remove publisher privileges from an active account and revert its role to reader.
        </p>

        <form
          onSubmit={(event) => void handleRevokePublisher(event)}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end"
        >
          <label className="text-sm text-slate-700">
            Publisher UID <span className="text-rose-600">*</span>
            <input
              type="text"
              required
              disabled={revoking}
              value={revokeUid}
              onChange={(event) => setRevokeUid(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter publisher user ID"
            />
          </label>

          <label className="text-sm text-slate-700">
            Revocation reason <span className="text-rose-600">*</span>
            <input
              type="text"
              required
              disabled={revoking}
              value={revokeReason}
              onChange={(event) => setRevokeReason(event.target.value)}
              maxLength={REJECTION_REASON_MAX_LENGTH}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Policy or audit reason"
            />
          </label>

          <div>
            <button
              type="submit"
              disabled={revoking}
              className="w-full rounded-lg border border-rose-300 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {revoking ? "Revoking..." : "Revoke Publisher"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}