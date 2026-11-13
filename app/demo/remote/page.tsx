import type { Metadata } from "next";
import { StageRemote } from "@/components/demo/remote";

// A presenter's phone as a clicker for the /demo stage (components/demo/remote.tsx).
export const metadata: Metadata = { title: "Demo remote" };

export default function DemoRemotePage() {
  return <StageRemote />;
}
