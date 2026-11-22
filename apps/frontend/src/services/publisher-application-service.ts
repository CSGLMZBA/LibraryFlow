import type {
  ApiResponse,
  CreatePublisherApplicationDto,
  PublisherApplication,
  ReviewPublisherApplicationDto,
} from "@library-flow/shared";
import { authService } from "./auth-service";
import {
  normalizePublisherApplicationInput,
  validateCreatePublisherApplication,
} from "../schemas/publisher-application-schema";

const API_BASE_URL = (
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env
    ?.VITE_API_BASE_URL ?? ""
).replace(/\/$/, "");

async function apiRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const token = authService.getAccessToken();
  if (!token) {
    return {
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "An active cloud session token is required to submit or review applications.",
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    return {
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Unable to reach the LibraryFlow API server. Please try again.",
      },
    };
  }

  const parsed: unknown = await response.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return {
      success: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Received an invalid response from the server.",
      },
    };
  }

  const envelope = parsed as ApiResponse<T>;
  if (!response.ok || !envelope.success) {
    if ("error" in envelope && envelope.error) {
      return {
        success: false,
        error: {
          code: envelope.error.code || "REQUEST_FAILED",
          message: envelope.error.message || "The request could not be completed.",
          ...(envelope.error.field ? { field: envelope.error.field } : {}),
        },
      };
    }
    return {
      success: false,
      error: {
        code: "REQUEST_FAILED",
        message: "The request could not be completed.",
      },
    };
  }

  return envelope;
}

export const publisherApplicationService = {
  async submitApplication(
    rawInput: CreatePublisherApplicationDto,
  ): Promise<ApiResponse<PublisherApplication>> {
    const errors = validateCreatePublisherApplication(rawInput);
    const firstField = Object.keys(errors)[0] as keyof typeof errors | undefined;
    if (firstField) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: errors[firstField] ?? "Invalid publisher application input.",
          field: firstField,
        },
      };
    }

    const payload = normalizePublisherApplicationInput(rawInput);
    return apiRequest<PublisherApplication>("/publisher-applications", "POST", payload);
  },

  async listMyApplications(): Promise<ApiResponse<PublisherApplication[]>> {
    return apiRequest<PublisherApplication[]>("/publisher-applications/me", "GET");
  },

  async listPendingApplications(): Promise<ApiResponse<PublisherApplication[]>> {
    return apiRequest<PublisherApplication[]>(
      "/moderation/publisher-applications?status=pending",
      "GET",
    );
  },

  async approveApplication(
    applicationId: string,
    revision: number,
  ): Promise<ApiResponse<PublisherApplication>> {
    return apiRequest<PublisherApplication>(
      `/moderation/publisher-applications/${encodeURIComponent(applicationId)}/approve`,
      "POST",
      { revision },
    );
  },

  async rejectApplication(
    applicationId: string,
    revision: number,
    decisionReason: string,
  ): Promise<ApiResponse<PublisherApplication>> {
    const payload: ReviewPublisherApplicationDto & { revision: number } = {
      revision,
      decisionReason: decisionReason.trim(),
    };
    return apiRequest<PublisherApplication>(
      `/moderation/publisher-applications/${encodeURIComponent(applicationId)}/reject`,
      "POST",
      payload,
    );
  },

  
async revokePublisher(
    publisherUid: string,
    decisionReason: string,
  ): Promise<ApiResponse<{ uid: string; role: "reader" }>> {
    const payload: ReviewPublisherApplicationDto = {
      decisionReason: decisionReason.trim(),
    };
    return apiRequest<{ uid: string; role: "reader" }>(
      `/moderation/publishers/${encodeURIComponent(publisherUid)}/revoke`,
      "POST",
      payload,
    );
  },
};