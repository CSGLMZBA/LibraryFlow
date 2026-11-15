import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "library-flow-api" });
});

app.listen(port, () => {
  console.log(`LibraryFlow API listening on port ${port}`);
});
