import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOOK_MAX_FILE_SIZE_BYTES } from '../../packages/shared/src/schemas/limits.ts';
import { BookService } from '../../apps/backend/src/services/book-service.ts';
import { BookRepository } from '../../apps/backend/src/repositories/book-repository.ts';
import { ClassificationService } from '../../apps/backend/src/services/classification-service.ts';
import { CommentService } from '../../apps/backend/src/services/comment-service.ts';
import { ModerationService } from '../../apps/backend/src/services/moderation-service.ts';
import { commentRepository as frontendCommentRepo } from '../../apps/frontend/src/repositories/comment-repository.ts';
const visible = async () => true;

function createInMemoryRepos() {
  const categoriesMap = new Map();
  const genresMap = new Map();
  const commentsMap = new Map();
  const notifications = [];

  const bookRepo = new BookRepository();

  const classificationRepo = {
    getCategories: () => Array.from(categoriesMap.values()),
    getGenres: () => Array.from(genresMap.values()),
    createCategory: (name) => {
      const item = { id: `cat-${categoriesMap.size + 1}`, name };
      categoriesMap.set(item.id, item);
      return item;
    },
    createGenre: (name) => {
      const item = { id: `gen-${genresMap.size + 1}`, name };
      genresMap.set(item.id, item);
      return item;
    },
    updateCategory: (id, name) => {
      if (!categoriesMap.has(id)) return null;
      const updated = { id, name };
      categoriesMap.set(id, updated);
      return updated;
    },
    updateGenre: (id, name) => {
      if (!genresMap.has(id)) return null;
      const updated = { id, name };
      genresMap.set(id, updated);
      return updated;
    },
  };

  const commentRepo = {
    async create(comment) {
      commentsMap.set(comment.id, { ...comment });
      return { ...comment };
    },
    async findById(id) {
      const c = commentsMap.get(id);
      return c ? { ...c } : null;
    },
    async findByBookId(bookId) {
      return Array.from(commentsMap.values())
        .filter((c) => c.bookId === bookId && !c.isDeleted)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async softDelete(id, audit) {
      const c = commentsMap.get(id);
      if (!c) return null;
      const deleted = {
        ...c,
        isDeleted: true,
        moderatedBy: audit.moderatorId,
        moderationReason: audit.reason,
        moderatedAt: audit.moderatedAt,
      };
      commentsMap.set(id, deleted);
      return deleted;
    },
  };

  const notificationRepo = {
    async create(notification) {
      notifications.push(notification);
      return notification;
    },
    list: () => [...notifications],
  };

  return { bookRepo, classificationRepo, commentRepo, notificationRepo };
}

test('S1-AC-002 (TC-008, TC-010): valid EPUB/PDF up to 20 MB enters pending; invalid file rejected', async () => {
  const { bookRepo } = createInMemoryRepos();
  const service = new BookService(bookRepo, undefined, visible);

  const validBook = await service.createBook(
    {
      title: 'Compilers: Principles, Techniques, and Tools',
      author: 'Alfred V. Aho',
      fileType: 'pdf',
      fileSizeBytes: BOOK_MAX_FILE_SIZE_BYTES,
      categoryIds: ['cat-1'],
      genreIds: ['gen-1'],
    },
    'pub-1',
  );

  assert.equal(validBook.status, 'pending');
  assert.equal(validBook.ownerId, 'pub-1');
  assert.ok(validBook.accessKey.length > 0);
  assert.equal((await service.getApprovedCatalog()).length, 0);

  await assert.rejects(
    () =>
      service.createBook(
        {
          title: 'Too Large Book',
          author: 'Author',
          fileType: 'epub',
          fileSizeBytes: BOOK_MAX_FILE_SIZE_BYTES + 1,
          categoryIds: [],
          genreIds: [],
        },
        'pub-1',
      ),
    /Book file size must be between/,
  );

  await assert.rejects(
    () =>
      service.createBook(
        {
          title: 'Invalid Executable',
          author: 'Author',
          fileType: 'exe',
          fileSizeBytes: 1024,
          categoryIds: [],
          genreIds: [],
        },
        'pub-1',
      ),
    /must be epub or pdf/,
  );
});

test('S1-AC-003 (TC-014, TC-015): approve exposes book; reject notifies owner and schedules +24h deletion', async () => {
  const { bookRepo, commentRepo, notificationRepo } = createInMemoryRepos();
  const bookService = new BookService(bookRepo, undefined, visible);
  const modService = new ModerationService(bookRepo, commentRepo, notificationRepo);

  const b1 = await bookService.createBook(
    { title: 'Operating Systems', author: 'Tanenbaum', fileType: 'pdf', fileSizeBytes: 5000, categoryIds: [], genreIds: [] },
    'pub-1',
  );
  const b2 = await bookService.createBook(
    { title: 'Spam Upload', author: 'Unknown', fileType: 'pdf', fileSizeBytes: 5000, categoryIds: [], genreIds: [] },
    'pub-2',
  );

  const approved = await modService.approveBook(b1.id, 'mod-1');
  assert.equal(approved.status, 'approved');
  assert.equal((await bookService.getApprovedCatalog()).length, 1);

  await assert.rejects(() => modService.rejectBook(b2.id, '   ', 'mod-1'), /Moderation reason/);

  const rejected = await modService.rejectBook(b2.id, 'Duplicated content without authorization', 'mod-1');
  assert.equal(rejected.status, 'rejected');
  assert.ok(rejected.scheduledDeletionDate);
  const diffHours =
    (new Date(rejected.scheduledDeletionDate).getTime() - new Date(rejected.rejectionDate).getTime()) /
    (1000 * 60 * 60);
  assert.equal(Math.round(diffHours), 24);
  assert.equal(notificationRepo.list().length, 1);
  assert.equal(notificationRepo.list()[0].userId, 'pub-2');
});

test('S1-AC-004 & S1-AC-005 (TC-017..TC-022): owner-only metadata update, identity preservation & search filters', async () => {
  const { bookRepo, commentRepo, notificationRepo } = createInMemoryRepos();
  const bookService = new BookService(bookRepo, undefined, visible);
  const modService = new ModerationService(bookRepo, commentRepo, notificationRepo);

  const created = await bookService.createBook(
    { title: 'Signals and Systems', author: 'Oppenheim', fileType: 'pdf', fileSizeBytes: 4096, categoryIds: ['cat-1'], genreIds: ['gen-1'] },
    'pub-owner',
  );
  await modService.approveBook(created.id, 'mod-1');

  // No propietario rechazado
  await assert.rejects(
    () => bookService.updateBookMetadata(created.id, { title: 'Hacked Title' }, 'pub-other'),
    /not authorized/,
  );

  // Propietario actualiza preservando id, ownerId y createdAt
  const updated = await bookService.updateBookMetadata(
    created.id,
    { title: 'Signals & Systems 2nd Ed' },
    'pub-owner',
  );
  assert.equal(updated.id, created.id);
  assert.equal(updated.ownerId, 'pub-owner');
  assert.equal(updated.createdAt, created.createdAt);

  // Case-insensitive search plus combined filters
  const match = await bookService.getApprovedCatalog({
    search: 'oppenheim',
    categoryId: 'cat-1',
    genreId: 'gen-1',
  });
  assert.equal(match.length, 1);

  const empty = await bookService.getApprovedCatalog({ search: 'no-existe-xyz' });
  assert.equal(empty.length, 0);
});

test('S1-AC-006 (TC-023, TC-024): category and genre uniqueness and rename', () => {
  const { classificationRepo } = createInMemoryRepos();
  const service = new ClassificationService(classificationRepo);

  const cat = service.createClassification({ name: 'Computer Science', type: 'category' });
  assert.throws(
    () => service.createClassification({ name: 'computer science', type: 'category' }),
    /must be unique/,
  );

  const renamed = service.updateClassification(cat.id, 'category', { name: 'Computing & AI' });
  assert.equal(renamed.id, cat.id);
  assert.equal(renamed.name, 'Computing & AI');
});

test('S1-AC-007 (TC-027, TC-030): comment creation, moderation audit, notification, and newest-first order', async () => {
  const { bookRepo, commentRepo, notificationRepo } = createInMemoryRepos();
  const bookService = new BookService(bookRepo, undefined, visible);
  const commentService = new CommentService(bookRepo, commentRepo, visible);
  const modService = new ModerationService(bookRepo, commentRepo, notificationRepo);

  const book = await bookService.createBook(
    { title: 'Database Internals', author: 'Alex Petrov', fileType: 'epub', fileSizeBytes: 3000, categoryIds: [], genreIds: [] },
    'pub-1',
  );
  await modService.approveBook(book.id, 'mod-1');

  const c1 = await commentService.addComment(book.id, '  Primer comentario  ', 'reader-1', 'Reader1001');
  assert.equal(c1.content, 'Primer comentario');

  await modService.removeComment(c1.id, 'Lenguaje ofensivo', 'mod-1');
  const afterMod = await commentService.getCommentsForBook(book.id);
  assert.equal(afterMod.length, 0);
  assert.equal(notificationRepo.list().at(-1)?.type, 'comment_removed');

  // Verify descending chronological order (newest first) in the frontend repository
  const records = new Map([
    ['old', { id: 'old', bookId: 'b-order', authorId: 'u1', authorDisplayName: 'U1', content: 'Old', createdAt: '2026-11-18T08:00:00.000Z', isDeleted: false }],
    ['new', { id: 'new', bookId: 'b-order', authorId: 'u2', authorDisplayName: 'U2', content: 'New', createdAt: '2026-11-18T12:00:00.000Z', isDeleted: false }],
  ]);
  globalThis.IDBKeyRange = { only: (v) => v };
  globalThis.indexedDB = {
    open: () => {
      const req = { result: null, onupgradeneeded: null, onsuccess: null };
      const db = {
        objectStoreNames: { contains: () => true },
        transaction: () => ({
          objectStore: () => ({
            index: () => ({
              getAll: () => {
                const r = { result: Array.from(records.values()), onsuccess: null };
                queueMicrotask(() => r.onsuccess && r.onsuccess());
                return r;
              },
            }),
          }),
        }),
      };
      queueMicrotask(() => {
        req.result = db;
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };

  const frontendList = await frontendCommentRepo.getCommentsByBookId('b-order');
  assert.equal(
    frontendList[0]?.id,
    'new',
    'US-REA-012 CA-004 defect: commentRepository sorts ascending (oldest first) instead of descending (newest first)',
  );
});