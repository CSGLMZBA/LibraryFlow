import BookCard from "../components/BookCard";

// Información mínima para representar un libro.
type CatalogBook = {
  id: string;
  title: string;
  author: string;
};

export default function CatalogPage() {
  // Lista temporalmente vacía.
  // La conexión a datos llegará en el Commit 2.
  const books: CatalogBook[] = [];

  return (
    <section aria-labelledby="catalog-title">
      <h2
        id="catalog-title"
        className="mb-2 text-2xl font-bold"
      >
        Catálogo de libros
      </h2>

      <p className="mb-8 text-gray-600">
        Explora los libros aprobados y disponibles
        en nuestra biblioteca.
      </p>

      {/* Mostrar el catálogo o el estado vacío */}
      {books.length === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-gray-200 bg-white p-10 text-center"
        >
          <h3 className="text-xl font-semibold">
            No hay libros disponibles
          </h3>

          <p className="mt-3 text-gray-600">
            Los libros aprobados aparecerán aquí
            cuando se conecte el catálogo.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <li key={book.id}>
              <BookCard
                title={book.title}
                author={book.author}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
