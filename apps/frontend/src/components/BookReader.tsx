import { useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import type { OfflineBook } from "../services/offline-book-service";

interface BookReaderProps {
  book: OfflineBook;
  onClose: () => void;
}

export default function BookReader({ book, onClose }: BookReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<{ next: () => Promise<void>; prev: () => Promise<void>; destroy: () => void } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let epubBook: ReturnType<typeof ePub> | null = null;

    async function openBook() {
      setIsLoading(true);
      setError(null);
      try {
        if (book.fileFormat === "pdf") {
          objectUrl = URL.createObjectURL(new Blob([book.fileBlob], { type: "application/pdf" }));
          if (!cancelled) setPdfUrl(objectUrl);
          return;
        }
        const buffer = await book.fileBlob.arrayBuffer();
        if (cancelled || !viewerRef.current) return;
        epubBook = ePub(buffer);
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        await rendition.display();
      } catch {
        if (!cancelled) setError("Could not open this file. Verify that it is a valid PDF or EPUB.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void openBook();
    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      epubBook?.destroy();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book]);

  return (
    <section aria-labelledby="offline-reader-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="offline-reader-title" className="text-2xl font-bold text-slate-900">{book.title}</h2>
          <p className="text-sm text-slate-600">{book.author} · Offline copy saved</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50">
          Back to catalog
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {isLoading && <p role="status">Opening book...</p>}
      {book.fileFormat === "pdf" && pdfUrl && (
        <iframe src={pdfUrl} title={`Reading ${book.title}`} className="h-[72vh] w-full rounded-xl border border-slate-300" />
      )}
      {book.fileFormat === "epub" && (
        <>
          <div ref={viewerRef} className="h-[68vh] w-full rounded-xl border border-slate-300 bg-white" />
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => void renditionRef.current?.prev()} disabled={isLoading || Boolean(error)} className="rounded-lg bg-slate-200 px-5 py-2 disabled:opacity-50">Previous page</button>
            <button type="button" onClick={() => void renditionRef.current?.next()} disabled={isLoading || Boolean(error)} className="rounded-lg bg-indigo-600 px-5 py-2 text-white disabled:opacity-50">Next page</button>
          </div>
        </>
      )}
    </section>
  );
}
