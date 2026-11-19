
/**
 * PB-003 - Visual card for a book.
 * Displays data supplied by the catalog.
 * It does not query APIs or databases.
 */

type BookCardProps = {
  title: string;
  author: string;
};

export default function BookCard({
  title,
  author,
}: BookCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Generic image until a cover exists */}
      <div
        className="flex h-40 items-center justify-center bg-blue-50"
        aria-hidden="true"
      >
        <span className="text-5xl">📖</span>
      </div>

      {/* Book information */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {title}
        </h3>

        <p className="mt-2 text-sm text-gray-600">
          Author: {author}
        </p>
      </div>
    </article>
  );
}
