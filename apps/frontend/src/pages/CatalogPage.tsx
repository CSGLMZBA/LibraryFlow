import { useCallback, useEffect, useMemo, useState } from "react";
import BookCard from "../components/BookCard";
import BookReader from "../components/BookReader";
import { bookRepository } from "../repositories/book-repository";
import {
  downloadBookForOffline,
  getOfflineBook,
  listOfflineBookIds,
  type DownloadState,
  type OfflineBook,
} from "../services/offline-book-service";
import { filterCatalogBooks } from "../utils/filter-catalog-books";
import type { BookRecord } from "../types/book";

export default function CatalogPage() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [genreId, setGenreId] = useState("");
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null);
  const [readingBook, setReadingBook] = useState<OfflineBook | null>(null);
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});

  const categories = useMemo(() => bookRepository.getCategories(), []);
  const genres = useMemo(() => bookRepository.getGenres(), []);
  const visibleGenres = useMemo(
    () => categoryId ? genres.filter((genre) => genre.categoryId === categoryId) : genres,
    [genres, categoryId]
  );

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [approved, offlineIds] = await Promise.all([
        bookRepository.getAllBooks().then((allBooks) =>
          allBooks
            .filter((book) => book.status === "approved")
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        ),
        listOfflineBookIds(),
      ]);
      setBooks(approved);
      const saved: Record<string, DownloadState> = {};
      offlineIds.forEach((id) => { saved[id] = "Completed"; });
      setDownloadStates(saved);
    } catch {
      setError("No fue posible cargar el catálogo. Revisa el almacenamiento del navegador.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const filteredBooks = useMemo(
    () => filterCatalogBooks(books, { search, categoryId, genreId }),
    [books, search, categoryId, genreId]
  );

  const selectedState: DownloadState = selectedBook
    ? downloadStates[selectedBook.id] ?? "Not Started"
    : "Not Started";

  const hasFilters = Boolean(search.trim() || categoryId || genreId);

  function changeCategory(id: string) {
    setCategoryId(id);
    if (genreId && id && !genres.some((genre) => genre.id === genreId && genre.categoryId === id)) {
      setGenreId("");
    }
  }

  async function handleDownload(book: BookRecord) {
    setDownloadStates((previous) => ({ ...previous, [book.id]: "In Progress" }));
    setDownloadErrors((previous) => ({ ...previous, [book.id]: "" }));
    try {
      await downloadBookForOffline(book);
      setDownloadStates((previous) => ({ ...previous, [book.id]: "Completed" }));
    } catch (cause) {
      setDownloadStates((previous) => ({ ...previous, [book.id]: "Failed" }));
      setDownloadErrors((previous) => ({
        ...previous,
        [book.id]: cause instanceof Error ? cause.message : "Error al guardar el archivo. Inténtalo nuevamente.",
      }));
    }
  }

  async function handleRead(book: BookRecord) {
    try {
      if (book.status !== "approved") {
        throw new Error("Este libro no está aprobado para su lectura pública.");
      }
      const saved = await getOfflineBook(book.id);
      if (!saved || saved.fileBlob.size === 0) {
        throw new Error("Primero descarga una copia completa del libro.");
      }
      setReadingBook(saved);
    } catch (cause) {
      setDownloadErrors((previous) => ({
        ...previous,
        [book.id]: cause instanceof Error ? cause.message : "No se pudo abrir el libro.",
      }));
    }
  }

  async function handleSaveFile(book: BookRecord) {
    try {
      const saved = await getOfflineBook(book.id);
      if (!saved) throw new Error("Primero debes completar la descarga offline.");
      const url = URL.createObjectURL(saved.fileBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = saved.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (cause) {
      setDownloadErrors((previous) => ({
        ...previous,
        [book.id]: cause instanceof Error ? cause.message : "No se pudo guardar el archivo.",
      }));
    }
  }

  if (readingBook) {
    return <BookReader book={readingBook} onClose={() => setReadingBook(null)} />;
  }

  return (
    <section aria-labelledby="catalog-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="catalog-title" className="text-2xl font-bold text-slate-900">Catálogo de libros</h2>
          <p className="mt-1 text-slate-600">Busca libros aprobados, consulta sus detalles y guárdalos para leer sin conexión.</p>
        </div>
        <button type="button" onClick={() => void loadCatalog()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
          Actualizar catálogo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="book-search" className="mb-1 block text-sm font-medium">Buscar</label>
          <input id="book-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Título, autor o publicador..." className="w-full rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label htmlFor="book-category" className="mb-1 block text-sm font-medium">Categoría</label>
          <select id="book-category" value={categoryId} onChange={(e) => changeCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5">
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="book-genre" className="mb-1 block text-sm font-medium">Género</label>
          <select id="book-genre" value={genreId} onChange={(e) => setGenreId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5">
            <option value="">Todos los géneros</option>
            {visibleGenres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
          </select>
        </div>
        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="button" onClick={() => { setSearch(""); setCategoryId(""); setGenreId(""); }} className="text-sm font-medium text-indigo-600 hover:underline">Limpiar filtros</button>
          </div>
        )}
      </div>

      {loading ? <p role="status">Cargando catálogo...</p> : error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
      ) : (
        <>
          <p role="status" aria-live="polite" className="text-sm text-slate-600">{filteredBooks.length} libros encontrados</p>
          {selectedBook && (
            <section aria-labelledby="book-details-title" className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="book-details-title" className="text-xl font-bold text-slate-900">{selectedBook.title}</h3>
                  <p className="text-slate-600">Autor: {selectedBook.author}</p>
                  <p className="text-sm text-slate-600">Publicador: {selectedBook.ownerDisplayName}</p>
                </div>
                <button type="button" onClick={() => setSelectedBook(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Cerrar detalles</button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">{selectedBook.description}</p>
              <p className="mt-3 text-sm text-slate-600">Archivo: {selectedBook.fileFormat.toUpperCase()} · {(selectedBook.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
              <p role="status" aria-live="polite" className="mt-2 text-sm">Descarga: <strong>{selectedState}</strong></p>
              {downloadErrors[selectedBook.id] && <p role="alert" className="mt-2 text-sm text-red-700">{downloadErrors[selectedBook.id]}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={selectedState === "In Progress"} onClick={() => void handleDownload(selectedBook)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {selectedState === "In Progress" ? "Guardando..." : selectedState === "Failed" ? "Reintentar descarga" : selectedState === "Completed" ? "Actualizar copia offline" : "Descargar para leer offline"}
                </button>
                <button type="button" disabled={selectedState !== "Completed"} onClick={() => void handleRead(selectedBook)}
                  className="rounded-lg border border-indigo-500 bg-white px-4 py-2 text-sm text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Leer sin conexión
                </button>
                <button type="button" disabled={selectedState !== "Completed"} onClick={() => void handleSaveFile(selectedBook)}
                  className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  Guardar archivo en el equipo
                </button>
              </div>
            </section>
          )}
          {filteredBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
              {hasFilters ? "No se encontraron libros con esos filtros." : "Todavía no hay libros aprobados disponibles."}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBooks.map((book) => (
                <li key={book.id}>
                  <button type="button" onClick={() => { setSelectedBook(book); setDownloadErrors((previous) => ({ ...previous, [book.id]: "" })); }}
                    aria-label={`Ver detalles de ${book.title}`} className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <BookCard title={book.title} author={book.author} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
