
/**
 * PB-003 - Tarjeta visual de un libro.
 * Muestra los datos proporcionados por el catálogo.
 * No consulta APIs ni bases de datos.
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
      {/* Imagen genérica mientras no exista una portada */}
      <div
        className="flex h-40 items-center justify-center bg-blue-50"
        aria-hidden="true"
      >
        <span className="text-5xl">📖</span>
      </div>

      {/* Información del libro */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {title}
        </h3>

        <p className="mt-2 text-sm text-gray-600">
          Autor: {author}
        </p>
      </div>
    </article>
  );
}
