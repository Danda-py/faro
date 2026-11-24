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
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#080a12]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(79,70,229,0.18),transparent_36%),radial-gradient(ellipse_at_90%_22%,rgba(8,145,178,0.12),transparent_34%),linear-gradient(180deg,#0b0d17_0%,#080a12_65%,#090b13_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_74%)]" />
        </div>
        {children}
      </body>
    </html>
  );
}
