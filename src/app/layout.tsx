import type { Metadata, Viewport } from "next";
import { Rubik, Assistant } from "next/font/google";
import "./globals.css";

// Bold rounded Hebrew sans for headings — clean, modern, friendly
const fontDisplay = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const fontSans = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מרפאה — ניהול קליניקה",
  description: "מערכת לניהול קליניקה: לקוחות, פגישות, חשבוניות ותשלומים",
  appleWebApp: {
    capable: true,
    title: "מרפאה",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAF7F1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${fontDisplay.variable} ${fontSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
