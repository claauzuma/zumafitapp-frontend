import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,

    // ✅ NO fijes host de HMR a una IP que cambia
    hmr: true,

    proxy: {
      "/api": {
        target: "http://192.168.0.249:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
