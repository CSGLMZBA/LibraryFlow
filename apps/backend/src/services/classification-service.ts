import {
  CLASSIFICATION_NAME_MAX_LENGTH,
} from "@library-flow/shared";
import type {
  Category,
  CreateClassificationDto,
  Genre,
  UpdateClassificationDto,
} from "@library-flow/shared";
import {
  classificationRepository as defaultClassificationRepository,
  ClassificationRepository,
} from "../repositories/classification-repository.js";

type Classification = Category | Genre;

export class ClassificationService {
  public constructor(
    private readonly repository: ClassificationRepository =
      defaultClassificationRepository,
  ) {}

  listClassifications(): {
    categories: Category[];
    genres: Genre[];
  } {
    return {
      categories: this.repository.getCategories(),
      genres: this.repository.getGenres(),
    };
  }

  createClassification(dto: CreateClassificationDto): Classification {
    const name = this.validateName(dto.name);
    const classifications =
      dto.type === "category"
        ? this.repository.getCategories()
        : this.repository.getGenres();
    this.ensureUnique(name, classifications);

    return dto.type === "category"
      ? this.repository.createCategory(name)
      : this.repository.createGenre(name);
  }

  updateClassification(
    id: string,
    type: CreateClassificationDto["type"],
    dto: UpdateClassificationDto,
  ): Classification {
    const name = this.validateName(dto.name);
    const classifications =
      type === "category"
        ? this.repository.getCategories()
        : this.repository.getGenres();
    this.ensureUnique(name, classifications, id);

    const updatedClassification =
      type === "category"
        ? this.repository.updateCategory(id, name)
        : this.repository.updateGenre(id, name);
    if (!updatedClassification) {
      throw new Error("Classification not found.");
    }
    return updatedClassification;
  }

  private validateName(name: string): string {
    const normalizedName = name.trim();
    if (
      normalizedName.length === 0 ||
      normalizedName.length > CLASSIFICATION_NAME_MAX_LENGTH
    ) {
      throw new Error(
        `Classification name must contain between 1 and ${CLASSIFICATION_NAME_MAX_LENGTH} characters.`,
      );
    }
    return normalizedName;
  }

  private ensureUnique(
    name: string,
    classifications: Classification[],
    excludedId?: string,
  ): void {
    const normalizedName = name.toLocaleLowerCase();
    if (
      classifications.some(
        (classification) =>
          classification.id !== excludedId &&
          classification.name.toLocaleLowerCase() === normalizedName,
      )
    ) {
      throw new Error("Classification name must be unique.");
    }
  }
}

export const classificationService = new ClassificationService();
