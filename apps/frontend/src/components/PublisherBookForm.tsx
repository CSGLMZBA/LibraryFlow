import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BOOK_AUTHOR_MAX_LENGTH,
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_TITLE_MAX_LENGTH,
  validateCreateBookInput,
  validateUpdateBookInput,
} from "../schemas/book-schema";
import { bookService } from "../services/book-service";
import type { AuthUser } from "../types/auth";
import type { BookRecord, BookValidationErrors } from "../types/book";

interface PublisherBookFormProps {
  publisher: AuthUser;
  editingBook: BookRecord | null;
  onSuccess: (savedBook: BookRecord, message: string) => void;
  onCancelEdit: () => void;
}

export function PublisherBookForm({
  publisher,
  editingBook,
  onSuccess,
  onCancelEdit,
}: PublisherBookFormProps) {
  const categories = useMemo(() => bookService.getAvailableCategories(), []);
  const allGenres = useMemo(() => bookService.getAvailableGenres(), []);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [genreId, setGenreId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<BookValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredGenres = useMemo(
    () => allGenres.filter((g) => g.categoryId === categoryId),
    [allGenres, categoryId]
  );

  useEffect(() => {
    if (editingBook) {
      setTitle(editingBook.title);
      setAuthor(editingBook.author);
      setDescription(editingBook.description);
      setCategoryId(editingBook.categoryId);
      setGenreId(editingBook.genreId);
      setFile(null);
      setErrors({});
    } else {
      setTitle("");
      setAuthor("");
      setDescription("");
      const defaultCategory = categories[0]?.id ?? "";
      setCategoryId(defaultCategory);
      const firstGenre = allGenres.find((g) => g.categoryId === defaultCategory);
      setGenreId(firstGenre?.id ?? "");
      setFile(null);
      setErrors({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [editingBook, categories, allGenres]);

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    const firstValidGenre = allGenres.find((g) => g.categoryId === nextCategoryId);
    setGenreId(firstValidGenre?.id ?? "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    if (editingBook) {
      const clientErrors = validateUpdateBookInput(
        { title, author, description, categoryId, genreId },
        categories,
        allGenres
      );
      if (Object.keys(clientErrors).length > 0) {
        setErrors(clientErrors);
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await bookService.updateBookDetails(publisher, editingBook.id, {
          title,
          author,
          description,
          categoryId,
          genreId,
        });

        if (!result.success) {
          const field = result.error.field ?? "general";
          setErrors({ [field]: result.error.message });
          return;
        }

        onSuccess(result.data, result.message ?? "Book details updated.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const clientErrors = validateCreateBookInput(
        { title, author, description, categoryId, genreId, file },
        categories,
        allGenres
      );
      if (Object.keys(clientErrors).length > 0) {
        setErrors(clientErrors);
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await bookService.publishBook(publisher, {
          title,
          author,
          description,
          categoryId,
          genreId,
          file,
        });

        if (!result.success) {
          const field = result.error.field ?? "general";
          setErrors({ [field]: result.error.message });
          return;
        }

        setTitle("");
        setAuthor("");
        setDescription("");
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onSuccess(result.data, result.message ?? "Book submitted for approval.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <section
      aria-labelledby="book-form-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 id="book-form-heading" className="text-lg font-semibold text-slate-900">
            {editingBook ? "Edit Book Details & Classification" : "Share a New Book"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {editingBook
              ? "Update metadata and classification while preserving book identity and history."
              : "Upload an EPUB or PDF file (max 20 MB). Books enter pending-approval status until reviewed by a moderator."}
          </p>
        </div>

        {editingBook && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {errors.general && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="book-title" className="block text-sm font-medium text-slate-700">
              Book title
            </label>
            <input
              id="book-title"
              name="title"
              type="text"
              maxLength={BOOK_TITLE_MAX_LENGTH}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "book-title-error" : "book-title-hint"}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Clean Architecture"
            />
            {errors.title ? (
              <p id="book-title-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.title}
              </p>
            ) : (
              <p id="book-title-hint" className="mt-1 text-xs text-slate-500">
                {title.length}/{BOOK_TITLE_MAX_LENGTH} characters
              </p>
            )}
          </div>

          <div>
            <label htmlFor="book-author" className="block text-sm font-medium text-slate-700">
              Author
            </label>
            <input
              id="book-author"
              name="author"
              type="text"
              maxLength={BOOK_AUTHOR_MAX_LENGTH}
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              aria-invalid={Boolean(errors.author)}
              aria-describedby={errors.author ? "book-author-error" : "book-author-hint"}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Robert C. Martin"
            />
            {errors.author ? (
              <p id="book-author-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.author}
              </p>
            ) : (
              <p id="book-author-hint" className="mt-1 text-xs text-slate-500">
                {author.length}/{BOOK_AUTHOR_MAX_LENGTH} characters
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="book-description" className="block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="book-description"
            name="description"
            rows={3}
            maxLength={BOOK_DESCRIPTION_MAX_LENGTH}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "book-description-error" : "book-description-hint"
            }
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Summarize the book content for readers..."
          />
          {errors.description ? (
            <p id="book-description-error" role="alert" className="mt-1 text-xs text-red-600">
              {errors.description}
            </p>
          ) : (
            <p id="book-description-hint" className="mt-1 text-xs text-slate-500">
              {description.length}/{BOOK_DESCRIPTION_MAX_LENGTH} characters
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="book-category" className="block text-sm font-medium text-slate-700">
              Category
            </label>
            <select
              id="book-category"
              name="categoryId"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              aria-invalid={Boolean(errors.categoryId)}
              aria-describedby={errors.categoryId ? "book-category-error" : undefined}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p id="book-category-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.categoryId}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="book-genre" className="block text-sm font-medium text-slate-700">
              Genre
            </label>
            <select
              id="book-genre"
              name="genreId"
              value={genreId}
              onChange={(e) => setGenreId(e.target.value)}
              aria-invalid={Boolean(errors.genreId)}
              aria-describedby={errors.genreId ? "book-genre-error" : undefined}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {filteredGenres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
            {errors.genreId && (
              <p id="book-genre-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.genreId}
              </p>
            )}
          </div>
        </div>

        {!editingBook ? (
          <div>
            <label htmlFor="book-file" className="block text-sm font-medium text-slate-700">
              Book file (EPUB or PDF, max 20 MB)
            </label>
            <input
              ref={fileInputRef}
              id="book-file"
              name="file"
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-invalid={Boolean(errors.file)}
              aria-describedby={errors.file ? "book-file-error" : "book-file-hint"}
              className="mt-1 block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {errors.file ? (
              <p id="book-file-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.file}
              </p>
            ) : (
              <p id="book-file-hint" className="mt-1 text-xs text-slate-500">
                {file
                  ? `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
                  : "Accepted formats: .epub, .pdf up to 20 MB."}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              <span className="font-medium text-slate-800">Stored File:</span>{" "}
              {editingBook.fileName} ({editingBook.fileFormat.toUpperCase()},{" "}
              {(editingBook.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-800">Access Key:</span>{" "}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">
                {editingBook.accessKey}
              </code>
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving..."
              : editingBook
                ? "Save Book Changes"
                : "Submit Book for Approval"}
          </button>
        </div>
      </form>
    </section>
  );
}