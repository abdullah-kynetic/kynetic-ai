import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: { default: "Kynetic Portal", template: "%s · Kynetic Portal" },
  description: "Your Kynetic AI project, timeline, documents and results.",
  robots: { index: false, follow: false },
};
// CSP nonces (src/proxy.ts) require dynamic rendering for every page.
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }, { media: "(prefers-color-scheme: light)", color: "#f7f7f8" }] };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Theme lives in a cookie so the server renders the right palette on first paint (no inline script, CSP-safe).
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" className="h-full" data-theme={theme} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
