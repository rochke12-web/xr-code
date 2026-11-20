import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "XR-Code",
  description:
    "XR Code — AI agent. Ask anything, drop photos, plan, code, debug and explore.",
  openGraph: {
    title: "XR-Code",
    description:
      "XR Code — AI agent. Ask anything, drop photos, plan, code, debug and explore.",
    siteName: "XR-Code",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "XR-Code",
    description:
      "XR Code — AI agent. Ask anything, drop photos, plan, code, debug and explore.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
