  export type ApiError = {
    code: string;
    message: string;
    field?: string;
  };

  export type ApiResponse<T> =
    | { success: true; data: T }
    | { success: false; error: ApiError };
