import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "bill-production.example";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "BILL, INC. — Production Control",
    description:
      "Every moving part in sync: budgets, reconciliation, travel, crew, schedules, call sheets, locations, and client approvals.",
    openGraph: {
      title: "BILL, INC. — Production Control",
      description:
        "Every moving part in sync across commercial production.",
      type: "website",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "BILL, INC. Production Control — every moving part in sync" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "BILL, INC. — Production Control",
      description:
        "Every moving part in sync across commercial production.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
