import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Saat `npm run dev`, permintaan /api diteruskan ke FastAPI lokal (uvicorn di port 8000).
// Saat produksi (Vercel), frontend memanggil backend lewat variabel VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
