import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriBuy | The Verification Layer for Automotive Commerce",
  description:
    "VeriBuy powers standardized vehicle inspections, AI-driven condition scoring, and real-time market intelligence — ensuring confidence before every purchase.",
  keywords: [
    "vehicle inspection platform",
    "vehicle verification",
    "VIN decoding",
    "condition report software",
    "dealership inspection tools",
    "vehicle risk intelligence",
    "automotive SaaS",
    "AI vehicle scoring",
    "fleet inspection",
    "used car verification",
  ],
  openGraph: {
    title: "VeriBuy | The Verification Layer for Automotive Commerce",
    description:
      "Standardized inspections, AI condition scoring, and risk intelligence for the automotive ecosystem.",
    url: "https://getveribuy.com",
    siteName: "VeriBuy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VeriBuy | The Verification Layer for Automotive Commerce",
    description:
      "Standardized inspections, AI condition scoring, and risk intelligence for the automotive ecosystem.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
