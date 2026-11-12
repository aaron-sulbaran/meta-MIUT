import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { TopBar } from "@/components/ui/top-bar";
import { PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Free and cheap campus events near you today, picked by Muse.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-wash shadow-xl">
          <TopBar />
          <main className="flex-1 pb-4">{children}</main>
          <TabBar />
        </div>
      </body>
    </html>
  );
}
