import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PhoneScene } from "@/components/demo/phone-scene";
import { castFromSlug } from "@/lib/demo/beat-context";
import { CAST } from "@/lib/demo/beats";

// A presenter's personal link (/demo/phone/jing, jolyn, lisa, trish): their own
// phone shows their scene of the pitch and their taps move the projected stage.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const cast = castFromSlug((await params).slug);
  return {
    title: cast ? `${CAST[cast].name}'s phone` : "Demo phone",
    appleWebApp: { capable: true, statusBarStyle: "default", title: cast ? CAST[cast].name : "Demo" },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default async function DemoPhonePage({ params }: { params: Promise<{ slug: string }> }) {
  const cast = castFromSlug((await params).slug);
  if (!cast) notFound();
  return <PhoneScene cast={cast} />;
}
