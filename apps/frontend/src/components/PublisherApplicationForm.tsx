import { useEffect, useState, type FormEvent } from "react";
import {
  APPLICATION_WEBSITE_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  LEGAL_REP_NAME_MAX_LENGTH,
  PUBLISHER_NAME_MAX_LENGTH,
  type CreatePublisherApplicationDto,
  type PublisherApplication,
} from "@library-flow/shared";
import {
  validateCreatePublisherApplication,
  type PublisherApplicationValidationErrors,
} from "../schemas/publisher-application-schema";
import { publisherApplicationService } from "../services/publisher-application-service";

interface PublisherApplicationFormProps {
  onSubmitted?: (application: PublisherApplication) => void;
}

export function PublisherApplicationForm({ onSubmitted }: PublisherApplicationFormProps) {
  const [publisherName, setPublisherName] = useState("");
  const [legalRepresentativeName, setLegalRepresentativeName] = useState("");
  const [independentPublisher, setIndependentPublisher] = useState(true);
  const [publisherEmail, setPublisherEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [fieldErrors, setFieldErrors] = useState<PublisherApplicationValidationErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<PublisherApplication | null>(null);
  const [existingActiveApplication, setExistingActiveApplication] =
    useState<PublisherApplication | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void publisherApplicationService
      .listMyApplications()
      .then((result) => {
        if (!mounted) return;
        if (result.success) {
          const active = result.data.find(
            (app) => app.status === "pending" || app.status === "approved",
          );
          setExistingActiveApplication(active ?? null);
        }
      })
      .finally(() => {
        if (mounted) setLoadingExisting(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBannerError(null);

    const draft: CreatePublisherApplicationDto = {
      publisherName,
      legalRepresentativeName,
      independentPublisher,
      publisherEmail,
      website,
    };

    const clientErrors = validateCreatePublisherApplication(draft);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await publisherApplicationService.submitApplication(draft);
      if (!response.success) {
        if (response.error.field && response.error.field in draft) {
          setFieldErrors({
            [response.error.field]: response.error.message,
          });
        } else if (response.error.code === "DUPLICATE_RESOURCE") {
          setBannerError(
            "You already have an active publisher application. Only one active application is allowed at a time.",
          );
        } else {
          setBannerError(response.error.message);
        }
        return;
      }

      setSubmittedApplication(response.data);
      setExistingActiveApplication(response.data);
      setFieldErrors({});
      onSubmitted?.(response.data);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingExisting) {
    return (
      <section
        aria-busy="true"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <p role="status" className="text-sm text-slate-600">
          Checking publisher application eligibility...
        </p>
      </section>
    );
  }

  const activeRecord = submittedApplication ?? existingActiveApplication;

  if (activeRecord) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Publisher Application
            </h2>
            <p className="text-sm text-slate-600">
              Only one active publisher application is permitted per reader account.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {activeRecord.status}
          </span>
        </div>

        {submittedApplication && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Your publisher application was submitted and is awaiting moderator review.
          </div>
        )}

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Publisher / Organization</dt>
            <dd className="text-slate-900">{activeRecord.publisherName}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Legal Representative</dt>
            <dd className="text-slate-900">{activeRecord.legalRepresentativeName}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Publisher Type</dt>
            <dd className="text-slate-900">
              {activeRecord.independentPublisher ? "Independent Publisher" : "Organization / Press"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Public Contact Email</dt>
            <dd className="text-slate-900">{activeRecord.publisherEmail}</dd>
          </div>
          {activeRecord.website && (
            <div>
              <dt className="font-medium text-slate-500">Website</dt>
              <dd className="text-slate-900">{activeRecord.website}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-slate-500">Expiration Date</dt>
            <dd className="text-slate-900">
              {new Date(activeRecord.expiresAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Apply for Publisher Access
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Submit your publishing details for moderator approval. Your reader privileges remain
          active while your application is reviewed.
        </p>
      </div>

      {bannerError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {bannerError}
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="publisher-name"
            className="block text-sm font-medium text-slate-700"
          >
            Publisher or organization name <span className="text-rose-600">*</span>
          </label>
          <input
            id="publisher-name"
            name="publisherName"
            type="text"
            required
            maxLength={PUBLISHER_NAME_MAX_LENGTH}
            value={publisherName}
            onChange={(event) => setPublisherName(event.target.value)}
            aria-invalid={Boolean(fieldErrors.publisherName)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="e.g., Horizon Independent Press"
          />
          {fieldErrors.publisherName && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.publisherName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="legal-rep-name"
            className="block text-sm font-medium text-slate-700"
          >
            Legal representative name <span className="text-rose-600">*</span>
          </label>
          <input
            id="legal-rep-name"
            name="legalRepresentativeName"
            type="text"
            required
            maxLength={LEGAL_REP_NAME_MAX_LENGTH}
            value={legalRepresentativeName}
            onChange={(event) => setLegalRepresentativeName(event.target.value)}
            aria-invalid={Boolean(fieldErrors.legalRepresentativeName)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Full legal name"
          />
          {fieldErrors.legalRepresentativeName && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.legalRepresentativeName}</p>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            id="independent-publisher"
            name="independentPublisher"
            type="checkbox"
            checked={independentPublisher}
            onChange={(event) => setIndependentPublisher(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="independent-publisher" className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Independent publisher</span>
            <span className="block text-xs text-slate-500">
              Check this box if you publish independently rather than representing a registered publishing house.
            </span>
          </label>
        </div>

        <div>
          <label
            htmlFor="publisher-email"
            className="block text-sm font-medium text-slate-700"
          >
            Public publisher email <span className="text-rose-600">*</span>
          </label>
          <input
            id="publisher-email"
            name="publisherEmail"
            type="email"
            required
            maxLength={EMAIL_MAX_LENGTH}
            value={publisherEmail}
            onChange={(event) => setPublisherEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.publisherEmail)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="contact@publisher.example"
          />
          {fieldErrors.publisherEmail && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.publisherEmail}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="publisher-website"
            className="block text-sm font-medium text-slate-700"
          >
            Website (optional)
          </label>
          <input
            id="publisher-website"
            name="website"
            type="url"
            maxLength={APPLICATION_WEBSITE_MAX_LENGTH}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            aria-invalid={Boolean(fieldErrors.website)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="https://publisher.example"
          />
          {fieldErrors.website && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.website}</p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting application..." : "Submit Publisher Application"}
          </button>
        </div>
      </form>
    </section>
  );
}