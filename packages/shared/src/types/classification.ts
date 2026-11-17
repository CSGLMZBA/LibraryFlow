export type Category = {
  id: string;
  name: string;
};

export type Genre = {
  id: string;
  name: string;
};

export type CreateClassificationDto = {
  name: string;
  type: "category" | "genre";
};

export type UpdateClassificationDto = {
  name: string;
};
