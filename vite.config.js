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

    // Los reportes y capturas no forman parte del bundle y pueden contener
    // archivos temporales bloqueados por navegadores o herramientas de auditoría.
    watch: {
      ignored: ["**/artifacts/**"],
    },

    proxy: {
      "/api": {
        // Loopback evita depender de una IP local que puede cambiar.
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
