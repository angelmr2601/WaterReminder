import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Hydro",
        short_name: "Hydro",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/public/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/public/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});
