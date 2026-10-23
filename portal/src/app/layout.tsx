import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kynetic Portal", template: "%s · Kynetic Portal" },
  description: "Your Kynetic AI project, timeline, documents and results.",
  robots: { index: false, follow: false },
};
// CSP nonces (src/proxy.ts) require dynamic rendering for every page.
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#1c1916" }, { media: "(prefers-color-scheme: light)", color: "#faf8f5" }] };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Theme lives in a cookie so the server renders the right palette on first paint (no inline script, CSP-safe).
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" className={`h-full ${inter.variable} ${cormorant.variable}`} data-theme={theme} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
