import type { MetadataRoute } from "next";

// Сайтты телефонға қосымша ретінде орнату (PWA). iPhone-да хабарлама тек «На экран «Домой»» арқылы
// орнатылған нұсқаға келеді (iOS 16.4+).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AUTO MAX",
    short_name: "AutoMax",
    description: "AutoMax — сатылым, цех, қойма",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#ffffff",
    lang: "kk",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
