import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Faro — GitHub workspace",
  description:
    "Il tuo portale personale per gestire repository GitHub, file e revisioni con l'AI che preferisci.",
  applicationName: "Faro",
  appleWebApp: {
    capable: true,
    title: "Faro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen font-sans">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
