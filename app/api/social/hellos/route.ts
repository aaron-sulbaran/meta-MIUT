import type { NextRequest } from "next/server";
import { hellosTo, loadSocial } from "@/lib/social/going";
import { EVERYONE } from "@/lib/social/fixtures/people";

// GET ?to=<person id>: the hellos someone was sent, newest first, with who sent them
// and the line Muse wrote (the demo phones of Jolyn and Lisa show "Trish said hi").
export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!EVERYONE.some((person) => person.id === to)) return Response.json({ data: null, error: "Unknown person" }, { status: 400 });
  await loadSocial([]);
  const data = hellosTo(to).map((hello) => ({
    ...hello,
    fromName: EVERYONE.find((person) => person.id === hello.from)?.name ?? "Someone",
  }));
  return Response.json({ data, error: null });
}
