import assert from "node:assert/strict";
import { test } from "node:test";

const previousCloudContent = process.env.ENABLE_CLOUD_CONTENT;
process.env.ENABLE_CLOUD_CONTENT = "false";
const [
  { BookRepository, bookRepository },
  { FavoriteService },
  { InMemoryFavoriteRepository, favoriteRepository },
  { createFavoriteRouter },
] = await Promise.all([
  import("../../apps/backend/src/repositories/book-repository.ts"),
  import("../../apps/backend/src/services/favorite-service.ts"),
  import("../../apps/backend/src/repositories/favorite-repository.ts"),
  import("../../apps/backend/src/routes/favorite-routes.ts"),
]);
if (previousCloudContent === undefined) {
  delete process.env.ENABLE_CLOUD_CONTENT;
} else {
  process.env.ENABLE_CLOUD_CONTENT = previousCloudContent;
}

function book(id, status = "approved") {
  return {
    id,
    title: "Test book",
    author: "Test author",
    ownerId: "publisher-1",
    description: "A test book",
    status,
    accessKey: `key-${id}`,
    shareableUrl: `/books/${id}`,
    fileUrl: "",
    fileType: "pdf",
    fileSizeBytes: 1,
    categoryIds: [],
    genreIds: [],
    createdAt: "2026-11-26T00:00:00.000Z",
    updatedAt: "2026-11-26T00:00:00.000Z",
    revision: 1,
  };
}

function call(router, method, url) {
  return new Promise((resolve, reject) => {
    const response = {
      locals: {},
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve(this);
        return this;
      },
    };
    router.handle(
      { method, url, headers: {} },
      response,
      (error) => reject(error ?? new Error("Route not handled")),
    );
  });
}

function readerGuard(readerUid) {
  return (_request, response, next) => {
    response.locals.auth = { uid: readerUid, role: "reader" };
    next();
  };
}

test("in-memory favorites use deterministic IDs, isolate readers, and return copies", async () => {
  const repository = new InMemoryFavoriteRepository();
  const input = {
    id: "ignored",
    readerUid: "reader-a",
    bookId: "book-a",
    createdAt: "2026-11-26T00:00:00.000Z",
  };
  const saved = await repository.save(input);
  saved.readerUid = "mutated";

  assert.deepEqual(await repository.findByReaderAndBook("reader-a", "book-a"), {
    ...input,
    id: "reader-a_book-a",
  });
  assert.deepEqual(await repository.findByReaderId("reader-b"), []);
  assert.equal(await repository.delete("reader-a", "book-a"), true);
  assert.equal(await repository.delete("reader-a", "book-a"), false);
  repository.clear();
  assert.deepEqual(await repository.findByReaderId("reader-a"), []);
});

test("favorite service validates requests, adds idempotently, and omits unavailable books", async () => {
  const repository = new InMemoryFavoriteRepository();
  const books = new BookRepository();
  const service = new FavoriteService(repository, books);
  await books.save(book("available"));
  await books.save(book("hidden", "rejected"));

  await assert.rejects(service.addFavorite(" ", "available"), /Validation error/);
  await assert.rejects(service.addFavorite("reader", "missing"), /not available/);
  await assert.rejects(service.addFavorite("reader", "hidden"), /not available/);
  await assert.rejects(service.getFavorites(" "), /Validation error/);

  const first = await service.addFavorite("reader", "available");
  const second = await service.addFavorite("reader", "available");
  assert.deepEqual(second, first);
  assert.equal(first.id, "reader_available");

  await repository.save({
    id: "reader_hidden",
    readerUid: "reader",
    bookId: "hidden",
    createdAt: "2026-11-26T00:00:00.000Z",
  });
  assert.deepEqual(await service.getFavorites("reader"), [first]);
  assert.equal(await repository.findByReaderAndBook("reader", "hidden") !== null, true);
  assert.equal(await service.removeFavorite("reader", "available"), true);
  assert.equal(await service.removeFavorite("reader", "available"), false);
});

test("favorites routes return direct resource data and remain reader-private", async () => {
  favoriteRepository.clear();
  const bookId = `favorite-route-${Date.now()}`;
  const readerUid = `reader-${bookId}`;
  await bookRepository.save(book(bookId));

  const router = createFavoriteRouter(readerGuard(readerUid));
  const added = await call(router, "PUT", `/books/${bookId}/favorite`);
  assert.equal(added.statusCode, 200);
  assert.equal(added.body.success, true);
  assert.equal(added.body.data.id, `${readerUid}_${bookId}`);
  assert.equal("favorite" in added.body.data, false);

  const listed = await call(router, "GET", "/favorites");
  assert.deepEqual(listed.body.data, [added.body.data]);
  const otherReaderList = await call(
    createFavoriteRouter(readerGuard("other-reader")),
    "GET",
    "/favorites",
  );
  assert.deepEqual(otherReaderList.body.data, []);

  const removed = await call(router, "DELETE", `/books/${bookId}/favorite`);
  assert.deepEqual(removed.body, { success: true, data: { removed: true } });
  const missing = await call(router, "PUT", "/books/no-such-book/favorite");
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.body.error, {
    code: "NOT_FOUND",
    message: "Book not found or not available.",
  });
  const invalidReader = await call(
    createFavoriteRouter(readerGuard(" ")),
    "GET",
    "/favorites",
  );
  assert.equal(invalidReader.statusCode, 400);
  assert.deepEqual(invalidReader.body.error, {
    code: "VALIDATION_ERROR",
    message: "Validation error: readerUid is required.",
  });

  favoriteRepository.clear();
});
