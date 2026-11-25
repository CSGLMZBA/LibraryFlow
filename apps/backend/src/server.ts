import express from "express";
import { corsHeadersFor, parseFrontendOrigins } from "./config/cors-policy.js";
import { moderatorGuard } from "./middleware/moderator-guard.js";
import { removeComment } from "./controllers/moderation-controller.js";
import { authRouter } from "./routes/auth-routes.js";
import { bookRouter } from "./routes/book-routes.js";
import { classificationRouter } from "./routes/classification-routes.js";
import { moderationRouter } from "./routes/moderation-routes.js";
import { banRouter } from "./routes/ban-routes.js";
import { internalRouter } from "./routes/internal-routes.js";
import { publisherApplicationRouter } from "./routes/publisher-application-routes.js";

import { accountRouter } from "./routes/account-routes.js";
import { healthHandler } from "./routes/health-routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

const allowedOrigins = parseFrontendOrigins(
  process.env.FRONTEND_ORIGIN,
  process.env.NODE_ENV,
);

app.use((request, response, next) => {
  const headers = corsHeadersFor(request.headers.origin, allowedOrigins);
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "100kb" }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/internal", internalRouter);
app.use("/api/v1", accountRouter);
app.use("/api/v1/books", bookRouter);
app.use("/api/v1/classifications", classificationRouter);
app.use("/api/v1/publisher-applications", publisherApplicationRouter);
app.use("/api/v1/moderation", moderationRouter);
app.use("/api/v1/moderation", banRouter);
app.delete("/api/v1/comments/:commentId", moderatorGuard, removeComment);

app.get("/health", healthHandler);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "The request body contains malformed JSON.",
      },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "The server could not complete the request.",
    },
  });
});

app.listen(port, () => {
  console.log(`LibraryFlow API listening on port ${port}`);
});
