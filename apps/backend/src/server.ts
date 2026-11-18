import express from "express";
import { moderatorGuard } from "./middleware/moderator-guard.js";
import { removeComment } from "./controllers/moderation-controller.js";
import { authRouter } from "./routes/auth-routes.js";
import { bookRouter } from "./routes/book-routes.js";
import { classificationRouter } from "./routes/classification-routes.js";
import { moderationRouter } from "./routes/moderation-routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "100kb" }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/books", bookRouter);
app.use("/api/v1/classifications", classificationRouter);
app.use("/api/v1/moderation", moderationRouter);
app.delete("/api/v1/comments/:commentId", moderatorGuard, removeComment);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "library-flow-api" });
});

app.listen(port, () => {
  console.log(`LibraryFlow API listening on port ${port}`);
});
