import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AA Auto Body Shop | Collision Repair & Paint in Dallas, TX",
  description: "Free estimates and insurance claims handled at AA Auto Body Shop in Dallas, TX. Collision repair and paint with exact color matching. Call (214) 541-2788.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
