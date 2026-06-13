import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { MainNav } from "@/components/MainNav";
import { WhatsappIcon } from "@/components/ui/WhatsappIcon";
import { WaStatusBadge } from "@/components/WaStatusBadge";
import "./globals.css";
import { cn } from "@/lib/utils";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "WA Outreach",
  description: "Gestión de mensajes en frío por WhatsApp",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-background">
          <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4 overflow-x-auto">
              <div className="flex items-center gap-6 shrink-0">
                <span className="font-semibold text-sm text-whatsapp flex gap-1 items-center">
                  <WhatsappIcon />
                  <span>WA</span>
                  <span className="hidden md:inline-flex items-center gap-1">
                    <hr />
                    Outreach
                  </span>
                </span>
                <MainNav />
              </div>
              <WaStatusBadge />
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
