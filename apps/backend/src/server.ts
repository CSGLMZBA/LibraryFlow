import express from "express";
import { moderatorGuard } from "./middleware/moderator-guard.js";
import { removeComment } from "./controllers/moderation-controller.js";
import { authRouter } from "./routes/auth-routes.js";
import { bookRouter } from "./routes/book-routes.js";
import { classificationRouter } from "./routes/classification-routes.js";
import { moderationRouter } from "./routes/moderation-routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

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
