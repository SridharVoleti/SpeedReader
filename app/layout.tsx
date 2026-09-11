import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speed Reading",
  description: "Level 1 speed reading practice for students"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
