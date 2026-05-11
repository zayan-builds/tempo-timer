import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { SettingsProvider } from "@/lib/settings";
import { UpdaterBoot } from "@/components/UpdaterBoot";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tempo",
  description: "A focused speedcubing timer.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Tempo — cube timer",
    description: "A beautiful, private timer for solving the Rubik's cube.",
    images: ["/icon-512.png"],
  },
  twitter: {
    card: "summary",
    title: "Tempo — cube timer",
    description: "A beautiful, private timer for solving the Rubik's cube.",
    images: ["/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Tempo",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jetbrains.variable}`}>
      <body className={cormorant.className}>
        <SettingsProvider>
          <UpdaterBoot />
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
