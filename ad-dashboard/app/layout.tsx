import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ad Performance Dashboard",
  description: "Kill, scale, and monitor ad campaigns based on live performance data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-dash-bg text-dash-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
