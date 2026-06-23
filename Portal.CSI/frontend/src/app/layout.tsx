import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"),
  title: {
    default: "CSI Portal",
    template: "%s | CSI Portal",
  },
  description: "Portal internal untuk manajemen event dan survey CSI end-to-end",
  openGraph: {
    title: "CSI Portal",
    description: "Portal internal untuk manajemen event dan survey CSI end-to-end",
    type: "website",
    siteName: "CSI Portal",
    images: [{ url: "/assets/img/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CSI Portal",
    description: "Portal internal untuk manajemen event dan survey CSI end-to-end",
    images: ["/assets/img/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
