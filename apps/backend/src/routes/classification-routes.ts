import { Router } from "express";
import {
  createClassification,
  listClassifications,
  updateClassification,
} from "../controllers/classification-controller.js";

export const classificationRouter = Router();

classificationRouter.get("/", listClassifications);
classificationRouter.post("/", createClassification);
classificationRouter.patch("/:id", updateClassification);
