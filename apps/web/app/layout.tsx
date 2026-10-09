import type { Metadata, Viewport } from "next";
import { Abel } from "next/font/google";
import "./globals.css";

const abel = Abel({ weight: "400", subsets: ["latin"], variable: "--font-abel", display: "swap" });

export const metadata: Metadata = {
  title: "Agent Knowledge",
  description: "Explore, govern, and connect your company knowledge, agent context, and ontology.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${abel.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>{children}</body>
    </html>
  );
}
