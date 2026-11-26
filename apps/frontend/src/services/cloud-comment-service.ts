import { COMMENT_MAX_LENGTH } from "@library-flow/shared";
import type { CommentServicePort } from "./comment-service-port";
import { cloudContentApi, ContentApiError, type CloudContentApi } from "./cloud-content-api";

function failure(error: unknown): { success: false; error: { code: string; message: string } } {
  if (error instanceof ContentApiError) return { success: false, error: { code: error.code, message: error.message } };
  return { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "The request could not be completed. Try again." } };
}

/** Comment screens backed by the Sprint 2 API. The author name is taken from the verified account by the server. */
export function createCloudCommentService(api: CloudContentApi = cloudContentApi): CommentServicePort {
  return {
    listBookComments: (bookId) => api.listComments(bookId),
    listAllForModeration: () => api.listModerationComments(),

    async moderateComment(moderator, commentId, reason) {
      if (moderator.role !== "moderator") {
        return { success: false, error: { code: "FORBIDDEN_ROLE", message: "Only moderators can remove comments." } };
      }
      const normalizedReason = reason.trim();
      if (!normalizedReason || normalizedReason.length > 500) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: "Removal reason must contain 1–500 characters." } };
      }
      try {
        return { success: true, data: await api.removeComment(commentId, normalizedReason) };
      } catch (error) {
        return failure(error);
      }
    },

    async getPublisherBookComments(publisher, bookId) {
      if (publisher.role !== "publisher") {
        return { success: false, error: { code: "FORBIDDEN_ROLE", message: "Only authenticated publishers can access this comment section." } };
      }
      try {
        // Ownership is enforced by the server: only approved, visible books expose comments.
        return { success: true, data: await api.listComments(bookId) };
      } catch (error) {
        return failure(error);
      }
    },

    async addReaderComment(bookId, _author, dto) {
      const trimmed = typeof dto.content === "string" ? dto.content.trim() : "";
      if (!trimmed) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: "Comment content cannot be empty." } };
      }
      if (trimmed.length > COMMENT_MAX_LENGTH) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: `Comment must not exceed ${COMMENT_MAX_LENGTH} characters.` } };
      }
      try {
        return { success: true, data: await api.addComment(bookId, trimmed) };
      } catch (error) {
        return failure(error);
      }
    },
  };
}
