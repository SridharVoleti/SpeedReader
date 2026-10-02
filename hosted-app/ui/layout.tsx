import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

// BabySteps Design Standard v1.0 (brand/Babysteps_Design_Standard_Final_v1.0.docx):
// Manrope for headings, Inter for functional UI/body text.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap"
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Speed Reading",
  description: "Level 1 speed reading practice for students"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
