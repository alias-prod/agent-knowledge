import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Knowledge",
  description: "Company brain for AI agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
