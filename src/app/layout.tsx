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
  themeColor: "#07080f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen font-sans">
        <PwaRegister />
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[#07080f]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_1200px_620px_at_8%_-12%,rgba(79,70,229,0.22),transparent_62%),radial-gradient(ellipse_980px_520px_at_100%_-4%,rgba(34,211,238,0.1),transparent_58%),radial-gradient(ellipse_900px_700px_at_50%_112%,rgba(139,92,246,0.09),transparent_62%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.016)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:76px_76px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
          <div className="bg-grain absolute inset-0 opacity-[0.035]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>
        {children}
      </body>
    </html>
  );
}
