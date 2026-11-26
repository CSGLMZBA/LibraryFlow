import assert from "node:assert/strict";
import { test } from "node:test";
import { createBook } from "../../apps/backend/src/controllers/book-controller.ts";
import { BookRepository, FirestoreBookRepository } from "../../apps/backend/src/repositories/book-repository.ts";
import { BookService } from "../../apps/backend/src/services/book-service.ts";

const base = {description: "About", fileType: "pdf", fileSizeBytes: 100, categoryIds: [], genreIds: []};
const service = () => new BookService(new BookRepository(), undefined, async () => true);

test("a title and author combination must be unique, ignoring case and spacing", async () => {
  const books = service();
  const first = await books.createBook({...base, title: "Dune", author: "Frank Herbert"}, "alice");
  await assert.rejects(books.createBook({...base, title: "  DUNE ", author: "frank herbert"}, "bob"), {name: "DuplicateBookError"});
  await books.createBook({...base, title: "Dune", author: "Someone Else"}, "bob");
  await books.createBook({...base, title: "Dune Messiah", author: "Frank Herbert"}, "bob");
  assert.equal((await books.listOwnedBooks("bob")).length, 2);
  assert.equal((await books.listOwnedBooks("alice")).length, 1);
  assert.equal(first.revision, 1);
});

test("renaming into an existing combination is refused and a deleted book frees its combination", async () => {
  const repository = new BookRepository();
  const books = new BookService(repository, undefined, async () => true);
  const one = await books.createBook({...base, title: "One", author: "A"}, "alice");
  const two = await books.createBook({...base, title: "Two", author: "A"}, "alice");
  await assert.rejects(books.updateBookMetadata(two.id, {title: "ONE", clientRevision: 1}, "alice"), {name: "DuplicateBookError"});
  assert.equal((await books.getBookDetails(two.id, "alice")).title, "Two");
  assert.equal((await books.getBookDetails(two.id, "alice")).revision, 1);
  const same = await books.updateBookMetadata(one.id, {title: " one ", description: "New"}, "alice");
  assert.equal(same.description, "New");
  await repository.update(one.id, {status: "deleted"});
  const renamed = await books.updateBookMetadata(two.id, {title: "One", clientRevision: 1}, "alice");
  assert.equal(renamed.title, "One");
  await books.createBook({...base, title: "Two", author: "A"}, "carol");
});

test("the controller reports a duplicate as 409 DUPLICATE_RESOURCE on the title field", async () => {
  const send = body => {
    const response = {statusCode: 200, locals: {auth: {uid: "controller-owner", role: "publisher"}},
      status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }};
    return createBook({body}, response).then(() => response);
  };
  const dto = {...base, title: "Controller Duplicate Check", author: "Author"};
  assert.equal((await send(dto)).statusCode, 201);
  const duplicate = await send({...dto, title: "controller duplicate check"});
  assert.equal(duplicate.statusCode, 409);
  assert.deepEqual([duplicate.body.error.code, duplicate.body.error.field], ["DUPLICATE_RESOURCE", "title"]);
});
