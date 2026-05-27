import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import SettingsProvider from "@/contexts/SettingsProvider";

export const metadata: Metadata = {
  title: "Ad Intel — Ad Performance Intelligence",
  description: "Kill, scale, and monitor ad campaigns based on live performance data.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-on-surface font-sans antialiased overflow-hidden">
        <SettingsProvider>
          <AppShell>{children}</AppShell>
        </SettingsProvider>
      </body>
    </html>
  );
}
