import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Moveable",
  description: "Physical therapy, tracked and connected.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Moveable" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en" className={`${inter.variable} antialiased h-full`}>
      <body
        className="min-h-full bg-background font-sans"
        style={{
          fontFamily:
            "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
