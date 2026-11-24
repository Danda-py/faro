import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faro — GitHub workspace",
  description:
    "Il tuo portale personale per gestire repository GitHub, file e revisioni con l'AI che preferisci.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen font-sans">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f5f6f8]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(219,234,254,0.48),transparent_54%)]" />
        </div>
        {children}
      </body>
    </html>
  );
}
