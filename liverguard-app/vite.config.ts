import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  server: {
    proxy: {
      // API 요청 프록시
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // WebSocket 프록시
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
