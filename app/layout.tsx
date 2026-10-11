import type { Metadata } from "next";
import "../src/frontend/styles.css";
import "../src/frontend/experience.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://citylogger.app"),
  title: "CityLog — Your world, ranked",
  description: "Log, rate and remember every city you visit."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
