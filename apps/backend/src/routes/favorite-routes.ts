import { Router, type RequestHandler } from "express";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../controllers/favorite-controller.js";
import { requireAuth } from "../middleware/identity.js";

export function createFavoriteRouter(
  guard: RequestHandler = requireAuth,
): Router {
  const router = Router();
  router.get("/favorites", guard, listFavorites);
  router.put("/books/:bookId/favorite", guard, addFavorite);
  router.delete("/books/:bookId/favorite", guard, removeFavorite);
  return router;
}

export const favoriteRouter = createFavoriteRouter();
