export type RatingStars = 1 | 2 | 3 | 4 | 5;

export type Rating = {
  id: string;
  readerUid: string;
  bookId: string;
  stars: RatingStars;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type RatingResponse = Rating & {
  readerDisplayName?: string;
};

export type RatingSummary = {
  bookId: string;
  count: number;
  average: number;
  updatedAt: string;
};

export type SetBookRatingDto = {
  stars: RatingStars;
  revision?: number;
};

export type DeleteBookRatingDto = {
  revision: number;
};
