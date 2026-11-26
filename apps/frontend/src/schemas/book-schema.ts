import type {
  AllowedBookFileFormat,
  BookCategory,
  BookGenre,
  BookValidationErrors,
  CreateBookInput,
  UpdateBookInput,
} from "../types/book";
import { genreMatchesCategory } from "../utils/classification";

export const BOOK_TITLE_MAX_LENGTH = 100;
export const BOOK_AUTHOR_MAX_LENGTH = 25;
export const BOOK_DESCRIPTION_MAX_LENGTH = 500;
export const BOOK_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES: Record<string, AllowedBookFileFormat> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

export function detectAllowedBookFormat(file: File): AllowedBookFileFormat | null {
  if (file.type && ALLOWED_MIME_TYPES[file.type]) {
    return ALLOWED_MIME_TYPES[file.type];
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "pdf";
  if (lowerName.endsWith(".epub")) return "epub";
  return null;
}

export function validateBookMetadataFields(
  input: {
    title: string;
    author: string;
    description: string;
    categoryId: string;
    genreId: string;
  },
  validCategories: BookCategory[],
  validGenres: BookGenre[]
): BookValidationErrors {
  const errors: BookValidationErrors = {};

  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    errors.title = "Title is required.";
  } else if (trimmedTitle.length > BOOK_TITLE_MAX_LENGTH) {
    errors.title = `Title must not exceed ${BOOK_TITLE_MAX_LENGTH} characters.`;
  }

  const trimmedAuthor = input.author.trim();
  if (!trimmedAuthor) {
    errors.author = "Author is required.";
  } else if (trimmedAuthor.length > BOOK_AUTHOR_MAX_LENGTH) {
    errors.author = `Author must not exceed ${BOOK_AUTHOR_MAX_LENGTH} characters.`;
  }

  const trimmedDescription = input.description.trim();
  if (!trimmedDescription) {
    errors.description = "Description is required.";
  } else if (trimmedDescription.length > BOOK_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must not exceed ${BOOK_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  const categoryExists = validCategories.some((c) => c.id === input.categoryId);
  if (!input.categoryId || !categoryExists) {
    errors.categoryId = "Select a valid moderator-approved category.";
  }

  const matchedGenre = validGenres.find((g) => g.id === input.genreId);
  if (!input.genreId || !matchedGenre) {
    errors.genreId = "Select a valid moderator-approved genre.";
  } else if (categoryExists && !genreMatchesCategory(matchedGenre, input.categoryId)) {
    errors.genreId = "Selected genre does not belong to the chosen category.";
  }

  return errors;
}

export function validateCreateBookInput(
  input: CreateBookInput,
  validCategories: BookCategory[],
  validGenres: BookGenre[]
): BookValidationErrors {
  const errors = validateBookMetadataFields(input, validCategories, validGenres);

  if (!input.file) {
    errors.file = "Book file (EPUB or PDF) is required.";
    return errors;
  }

  const detectedFormat = detectAllowedBookFormat(input.file);
  if (!detectedFormat) {
    errors.file = "Invalid file type. Only EPUB or PDF files are accepted.";
    return errors;
  }

  if (input.file.size <= 0) {
    errors.file = "The selected file is empty.";
    return errors;
  }

  if (input.file.size > BOOK_MAX_FILE_SIZE_BYTES) {
    errors.file = "File size exceeds the 20 MB maximum limit.";
  }

  return errors;
}

export function validateUpdateBookInput(
  input: UpdateBookInput,
  validCategories: BookCategory[],
  validGenres: BookGenre[]
): BookValidationErrors {
  return validateBookMetadataFields(input, validCategories, validGenres);
}