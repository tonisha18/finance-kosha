import type { Metadata } from "next";
import "./globals.css";
import { FloatingCoach } from "@/components/FloatingCoach";

export const metadata: Metadata = {
  title: "Kosha — Institutional Personal Finance & Ledger",
  description: "High-precision personal financial ledger and living cash-flow engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full flex flex-col font-sans bg-[#F8FAFC] dark:bg-[#090A0F] text-[#090A0F] dark:text-[#F8FAFC]">
        {children}
        <FloatingCoach />
      </body>
    </html>
  );
}
