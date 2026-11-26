import { useCallback, useEffect, useMemo, useState } from "react";
import { PublisherBookCommentsSection } from "../components/PublisherBookCommentsSection";
import { PublisherBookForm } from "../components/PublisherBookForm";
import { useClassifications } from "../hooks/use-classifications";
import { bookService } from "../services/book-service";
import type { AuthUser } from "../types/auth";
import type { BookModerationStatus, BookRecord } from "../types/book";

interface PublisherDashboardPageProps {
  publisher: AuthUser;
}

function renderStatusBadge(status: BookModerationStatus) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
          Approved (Public)
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Pending Approval
        </span>
      );
  }
}

export function PublisherDashboardPage({ publisher }: PublisherDashboardPageProps) {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [editingBook, setEditingBook] = useState<BookRecord | null>(null);
  const [selectedCommentsBook, setSelectedCommentsBook] = useState<BookRecord | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { categories, genres, error: classificationError } = useClassifications();

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const owned = await bookService.listPublisherBooks(publisher);
      setBooks(owned);
    } catch {
      setErrorMessage("Could not load your books from local storage.");
    } finally {
      setIsLoading(false);
    }
  }, [publisher]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const handleFormSuccess = async (savedBook: BookRecord, message: string) => {
    setBannerMessage(message);
    setErrorMessage(null);
    setEditingBook(null);
    if (selectedCommentsBook?.id === savedBook.id) {
      setSelectedCommentsBook(savedBook);
    }
    await loadBooks();
  };

  const handleDelete = async (book: BookRecord) => {
    setBannerMessage(null);
    setErrorMessage(null);
    const result = await bookService.deleteOwnedBook(publisher, book.id);
    if (!result.success) {
      setErrorMessage(result.error.message);
      return;
    }
    if (editingBook?.id === book.id) {
      setEditingBook(null);
    }
    if (selectedCommentsBook?.id === book.id) {
      setSelectedCommentsBook(null);
    }
    setBannerMessage(result.message ?? "Book deleted.");
    await loadBooks();
  };

  const resolveCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? "Unknown Category";

  const resolveGenreName = (genreId: string) =>
    genres.find((g) => g.id === genreId)?.name ?? "Unknown Genre";

  return (
    <div className="space-y-8">
      {bannerMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {bannerMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {classificationError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {classificationError}
        </div>
      )}

      <PublisherBookForm
        publisher={publisher}
        editingBook={editingBook}
        onSuccess={(saved, msg) => void handleFormSuccess(saved, msg)}
        onCancelEdit={() => setEditingBook(null)}
      />

      {selectedCommentsBook && (
        <PublisherBookCommentsSection
          publisher={publisher}
          book={selectedCommentsBook}
          onClose={() => setSelectedCommentsBook(null)}
        />
      )}

      <section
        aria-labelledby="owned-books-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="owned-books-heading" className="text-lg font-semibold text-slate-900">
              My Published &amp; Submitted Books
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Manage metadata, classifications, moderation status, and reader comments for your catalog.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {books.length} {books.length === 1 ? "book" : "books"}
          </span>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500">Loading your books...</p>
        ) : books.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            You have not submitted any books yet. Use the form above to share your first EPUB or PDF.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200">
            {books.map((book) => {
              const isViewingComments = selectedCommentsBook?.id === book.id;
              return (
                <li key={book.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{book.title}</h3>
                        {renderStatusBadge(book.status)}
                      </div>
                      <p className="text-sm text-slate-600">
                        by <span className="font-medium text-slate-800">{book.author}</span> &bull;{" "}
                        <span>{resolveCategoryName(book.categoryId)}</span> /{" "}
                        <span>{resolveGenreName(book.genreId)}</span>
                      </p>
                      <p className="text-sm text-slate-600">{book.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                        <span>
                          File: <strong className="uppercase">{book.fileFormat}</strong> (
                          {(book.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                        <span>
                          Access Key:{" "}
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                            {book.accessKey}
                          </code>
                        </span>
                      </div>
                      {book.status === "rejected" && book.rejectionReason && (
                        <p
                          role="alert"
                          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                        >
                          Rejection reason: {book.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCommentsBook(isViewingComments ? null : book)
                        }
                        aria-expanded={isViewingComments}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isViewingComments
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {isViewingComments ? "Hide Comments" : "View Comments"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBannerMessage(null);
                          setErrorMessage(null);
                          setEditingBook(book);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        Edit Details
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(book)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}