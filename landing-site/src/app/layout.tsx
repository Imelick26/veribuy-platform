import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriBuy — AI-Powered Vehicle Verification Infrastructure",
  description:
    "VeriBuy standardizes inspections, analyzes vehicle condition data, and surfaces risk intelligence for dealerships, marketplaces, lenders, and insurers.",
  keywords: [
    "vehicle inspection",
    "car verification",
    "VIN decode",
    "condition report",
    "dealership software",
    "vehicle risk assessment",
    "vehicle condition intelligence",
  ],
  openGraph: {
    title: "VeriBuy — AI-Powered Vehicle Verification Infrastructure",
    description:
      "Standardized inspections, AI condition scoring, and risk intelligence for the automotive ecosystem.",
    url: "https://getveribuy.com",
    siteName: "VeriBuy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VeriBuy — AI-Powered Vehicle Verification Infrastructure",
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
