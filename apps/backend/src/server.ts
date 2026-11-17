import express from "express";
import { bookRouter } from "./routes/book-routes.js";
import { classificationRouter } from "./routes/classification-routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.use("/api/v1/books", bookRouter);
app.use("/api/v1/classifications", classificationRouter);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "library-flow-api" });
});

app.listen(port, () => {
  console.log(`LibraryFlow API listening on port ${port}`);
});
