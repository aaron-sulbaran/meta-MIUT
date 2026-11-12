import type { Metadata, Viewport } from "next";
import { Geologica, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { AlertListener } from "@/components/alerts/alert-listener";
import { NearbyWatcher } from "@/components/muse/nearby-watcher";
import { TabBar } from "@/components/ui/tab-bar";
import { PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

const geologica = Geologica({ subsets: ["latin"], variable: "--font-geologica" });
const inter = Inter({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Free and cheap campus events near you today, picked by Muse.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

// The phone frame: a 390 px column centered on the wash on wide screens, full
// width on a phone. Each screen draws its own header; the floating tab bar is
// shared, and the bottom padding keeps content clear of it and the home indicator.
// AlertListener pins notification banners to the top of the frame on every screen.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geologica.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-page">
          <main className="flex-1 pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)]">{children}</main>
          <TabBar />
          <AlertListener />
          <NearbyWatcher />
        </div>
      </body>
    </html>
  );
}
