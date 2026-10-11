import type { Metadata, Viewport } from "next";
import { Abel } from "next/font/google";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME, PRODUCT_SHORT_NAME } from "@/lib/brand";
import "./globals.css";

const abel = Abel({ weight: "400", subsets: ["latin"], variable: "--font-abel", display: "swap" });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_SHORT_NAME}` },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  openGraph: {
    title: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    siteName: PRODUCT_NAME,
    type: "website",
  },
  twitter: { card: "summary", title: PRODUCT_NAME, description: PRODUCT_DESCRIPTION },
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
