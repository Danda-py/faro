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
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(76,29,149,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(8,145,178,0.22),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          <div className="absolute -left-32 top-[-10%] h-[420px] w-[420px] animate-float rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] animate-float rounded-full bg-cyan-500/15 blur-[120px] [animation-delay:-6s]" />
          <div className="absolute bottom-[-15%] left-1/3 h-[360px] w-[360px] rounded-full bg-fuchsia-600/10 blur-[130px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
