import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriBuy — Vehicle Verification, Reinvented",
  description:
    "The enterprise platform for AI-powered vehicle inspections, standardized condition reporting, and complete vehicle confidence.",
  keywords: [
    "vehicle inspection",
    "car verification",
    "VIN decode",
    "condition report",
    "dealership software",
    "vehicle risk assessment",
  ],
  openGraph: {
    title: "VeriBuy — Vehicle Verification, Reinvented",
    description:
      "The enterprise platform for AI-powered vehicle inspections and standardized condition reporting.",
    url: "https://getveribuy.com",
    siteName: "VeriBuy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VeriBuy — Vehicle Verification, Reinvented",
    description:
      "AI-powered vehicle inspections and standardized condition reporting.",
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
