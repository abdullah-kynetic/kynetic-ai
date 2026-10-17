import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: { default: "Kynetic Portal", template: "%s · Kynetic Portal" },
  description: "Your Kynetic AI project, timeline, documents and results.",
  robots: { index: false, follow: false },
};
// CSP nonces (src/proxy.ts) require dynamic rendering for every page.
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
