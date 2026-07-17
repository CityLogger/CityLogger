import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityLogger — Your world, ranked",
  description: "Log, rate and remember every city you visit."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
