import {
  APPLICATION_WEBSITE_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  LEGAL_REP_NAME_MAX_LENGTH,
  PUBLISHER_NAME_MAX_LENGTH,
  type CreatePublisherApplicationDto,
} from "@library-flow/shared";

export interface PublisherApplicationValidationErrors {
  publisherName?: string;
  legalRepresentativeName?: string;
  independentPublisher?: string;
  publisherEmail?: string;
  website?: string;
  general?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePublisherApplicationInput(
  input: CreatePublisherApplicationDto,
): CreatePublisherApplicationDto {
  const trimmedWebsite = input.website?.trim();
  return {
    publisherName: input.publisherName.trim(),
    legalRepresentativeName: input.legalRepresentativeName.trim(),
    independentPublisher: Boolean(input.independentPublisher),
    publisherEmail: input.publisherEmail.trim(),
    ...(trimmedWebsite ? { website: trimmedWebsite } : {}),
  };
}

export function validateCreatePublisherApplication(
  rawInput: CreatePublisherApplicationDto,
): PublisherApplicationValidationErrors {
  const errors: PublisherApplicationValidationErrors = {};
  const input = normalizePublisherApplicationInput(rawInput);

  if (!input.publisherName) {
    errors.publisherName = "Publisher or organization name is required.";
  } else if (input.publisherName.length > PUBLISHER_NAME_MAX_LENGTH) {
    errors.publisherName = `Publisher name must not exceed ${PUBLISHER_NAME_MAX_LENGTH} characters.`;
  }

  if (!input.legalRepresentativeName) {
    errors.legalRepresentativeName = "Legal representative name is required.";
  } else if (input.legalRepresentativeName.length > LEGAL_REP_NAME_MAX_LENGTH) {
    errors.legalRepresentativeName = `Legal representative name must not exceed ${LEGAL_REP_NAME_MAX_LENGTH} characters.`;
  }

  if (typeof input.independentPublisher !== "boolean") {
    errors.independentPublisher = "Independent publisher status must be specified.";
  }

  if (!input.publisherEmail) {
    errors.publisherEmail = "Public publisher email is required.";
  } else if (input.publisherEmail.length > EMAIL_MAX_LENGTH) {
    errors.publisherEmail = `Publisher email must not exceed ${EMAIL_MAX_LENGTH} characters.`;
  } else if (!EMAIL_PATTERN.test(input.publisherEmail)) {
    errors.publisherEmail = "Enter a valid email address.";
  }

  if (input.website !== undefined) {
    if (input.website.length > APPLICATION_WEBSITE_MAX_LENGTH) {
      errors.website = `Website URL must not exceed ${APPLICATION_WEBSITE_MAX_LENGTH} characters.`;
    } else {
      try {
        const parsed = new URL(input.website);
        if (parsed.protocol !== "https:") {
          errors.website = "Website URL must start with https://.";
        }
      } catch {
        errors.website = "Enter a valid https:// website URL.";
      }
    }
  }

  return errors;
}