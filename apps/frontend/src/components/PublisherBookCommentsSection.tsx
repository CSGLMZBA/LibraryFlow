import { useCallback, useEffect, useState, type FormEvent } from "react";
import { COMMENT_MAX_LENGTH, type BookComment } from "@library-flow/shared";
import { commentService } from "../services/comment-service";
import type { AuthUser } from "../types/auth";
import type { BookRecord } from "../types/book";

interface PublisherBookCommentsSectionProps {
  publisher: AuthUser;
  book: BookRecord;
  onClose: () => void;
}

function formatPublicationTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PublisherBookCommentsSection({
  publisher,
  book,
  onClose,
}: PublisherBookCommentsSectionProps) {
  const [comments, setComments] = useState<BookComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Optional local QA helper so you can verify CA-001, CA-002 & CA-004 standalone
  const [showSimulator, setShowSimulator] = useState(false);
  const [readerName, setReaderName] = useState("Demo Reader");
  const [readerContent, setReaderContent] = useState("");
  const [simError, setSimError] = useState<string | null>(null);
  const [isPostingSim, setIsPostingSim] = useState(false);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await commentService.getPublisherBookComments(publisher, book.id);
      if (!result.success) {
        setErrorMessage(result.error.message);
        setComments([]);
        return;
      }
      setComments(result.data);
    } catch {
      setErrorMessage("Could not load comments for this book.");
    } finally {
      setIsLoading(false);
    }
  }, [publisher, book.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSimulateReaderComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSimError(null);
    setIsPostingSim(true);
    try {
      const result = await commentService.addReaderComment(
        book.id,
        {
          id: `reader-sim-${readerName.trim().toLowerCase().replace(/\s+/g, "-") || "anon"}`,
          displayName: readerName.trim() || "Reader",
        },
        { content: readerContent }
      );
      if (!result.success) {
        setSimError(result.error.message);
        return;
      }
      setReaderContent("");
      await loadComments();
    } finally {
      setIsPostingSim(false);
    }
  };

  return (
    <section
      aria-labelledby="publisher-comments-heading"
      className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="publisher-comments-heading" className="text-lg font-semibold text-slate-900">
              Reader Comments — {book.title}
            </h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {comments.length} {comments.length === 1 ? "comment" : "comments"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Read-only publisher view. Comments are moderated exclusively under platform moderation policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadComments()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Reload Comments
          </button>
          <button
            type="button"
            onClick={() => setShowSimulator((prev) => !prev)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {showSimulator ? "Hide Reader Test Input" : "Simulate Reader Comment"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Close
          </button>
        </div>
      </div>

      {showSimulator && (
        <form
          onSubmit={handleSimulateReaderComment}
          className="mt-4 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 p-4"
        >
          <p className="text-xs font-medium text-indigo-900">
            Local QA Helper (simulates a persisted reader comment from US-REA-012 on this book):
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="sim-reader-name" className="block text-xs font-medium text-slate-700">
                Reader display name
              </label>
              <input
                id="sim-reader-name"
                type="text"
                value={readerName}
                onChange={(e) => setReaderName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="sim-reader-comment"
                className="block text-xs font-medium text-slate-700"
              >
                Comment ({readerContent.length}/{COMMENT_MAX_LENGTH})
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="sim-reader-comment"
                  type="text"
                  maxLength={COMMENT_MAX_LENGTH}
                  value={readerContent}
                  onChange={(e) => setReaderContent(e.target.value)}
                  placeholder="Write a reader opinion on this book..."
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isPostingSim}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isPostingSim ? "Adding..." : "Post"}
                </button>
              </div>
            </div>
          </div>
          {simError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {simError}
            </p>
          )}
        </form>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <div
            role="status"
            className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600"
          >
            No reader comments have been posted for <span className="font-medium">{book.title}</span>{" "}
            yet.
          </div>
        ) : (
          <ul aria-label={`Comments for ${book.title}`} className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {comment.authorDisplayName}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    className="text-xs text-slate-500"
                  >
                    {formatPublicationTime(comment.createdAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {comment.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}