import type { Metadata } from "next";
import { Stage } from "@/components/demo/stage";

// The pitch stage, projected during the demo. The operator console moved to
// /demo/console. Judges get the app itself, not this page.
export const metadata: Metadata = { title: "Demo stage" };

export default function DemoStagePage() {
  return <Stage />;
}
