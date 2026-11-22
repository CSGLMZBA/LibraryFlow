import { useCallback, useEffect, useState, type FormEvent } from "react";
import { COMMENT_MAX_LENGTH, type BookComment } from "@library-flow/shared";
import { commentRepository } from "../repositories/comment-repository";
import { bookService } from "../services/book-service";
import { commentService } from "../services/comment-service";
import type { AuthUser } from "../types/auth";
import type { BookRecord } from "../types/book";
import { ModeratorPublisherApplicationsSection } from "../components/ModeratorPublisherApplicationsSection";

interface ModeratorDashboardPageProps {
  moderator: AuthUser;
}

export default function ModeratorDashboardPage({ moderator }: ModeratorDashboardPageProps) {
  const [pending, setPending] = useState<BookRecord[]>([]);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [reasonByBook, setReasonByBook] = useState<Record<string, string>>({});
  const [reasonByComment, setReasonByComment] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pendingBooks, allComments] = await Promise.all([
        bookService.listPendingBooks(moderator),
        commentRepository.getAllComments(),
      ]);
      setPending(pendingBooks);
      setComments(allComments.filter((comment) => !comment.isDeleted)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      setError("Could not load moderation data.");
    }
  }, [moderator]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(book: BookRecord) {
    setMessage(null);
    setError(null);
    const result = await bookService.approveBook(moderator, book.id);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setMessage(result.message ?? "Book approved.");
    await load();
  }

  async function reject(event: FormEvent<HTMLFormElement>, book: BookRecord) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const result = await bookService.rejectBook(
      moderator,
      book.id,
      reasonByBook[book.id] ?? "",
    );
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setReasonByBook((previous) => ({ ...previous, [book.id]: "" }));
    setMessage(result.message ?? "Book rejected.");
    await load();
  }

  async function removeComment(comment: BookComment) {
    setMessage(null);
    setError(null);
    const reason = reasonByComment[comment.id] ?? "";
    const result = await commentService.moderateComment(moderator, comment.id, reason);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setReasonByComment((previous) => ({ ...previous, [comment.id]: "" }));
    setMessage("Comment removed and recorded in the moderation audit.");
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Moderation workspace</h2>
        <p className="mt-1 text-slate-600">
          Review publisher applications, approve or reject book submissions, and remove violating comments.
        </p>
      </div>

      <ModeratorPublisherApplicationsSection />

      {message && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

      <section aria-labelledby="pending-books-heading" className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 id="pending-books-heading" className="text-lg font-semibold">Pending book submissions</h3>
        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No pending submissions.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {pending.map((book) => (
              <li key={book.id} className="py-5 first:pt-0">
                <h4 className="font-semibold">{book.title}</h4>
                <p className="text-sm text-slate-600">by {book.author} · submitted by {book.ownerDisplayName}</p>
                <p className="mt-1 text-sm text-slate-600">{book.description}</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <button type="button" onClick={() => void approve(book)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                    Approve
                  </button>
                  <form onSubmit={(event) => void reject(event, book)} className="flex flex-1 flex-wrap items-end gap-2">
                    <label className="min-w-64 flex-1 text-sm">
                      Rejection reason
                      <input
                        value={reasonByBook[book.id] ?? ""}
                        onChange={(event) => setReasonByBook((previous) => ({ ...previous, [book.id]: event.target.value }))}
                        maxLength={500}
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                        placeholder="Explain why this submission was rejected"
                      />
                    </label>
                    <button type="submit" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="comments-heading" className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 id="comments-heading" className="text-lg font-semibold">Visible comments</h3>
        {comments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No comments available.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-800">{comment.content}</p>
                <p className="mt-1 text-xs text-slate-500">by {comment.authorDisplayName}</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-64 flex-1 text-sm">
                    Removal reason
                    <input
                      value={reasonByComment[comment.id] ?? ""}
                      onChange={(event) => setReasonByComment((previous) => ({ ...previous, [comment.id]: event.target.value }))}
                      maxLength={COMMENT_MAX_LENGTH}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Violation or policy reason"
                    />
                  </label>
                  <button type="button" onClick={() => void removeComment(comment)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}