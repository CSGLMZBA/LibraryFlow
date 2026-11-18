import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: { proxy: { "/api/v1/auth": "http://127.0.0.1:3000" } },
  plugins: [react()],
});
