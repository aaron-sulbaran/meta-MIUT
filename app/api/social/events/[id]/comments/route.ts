import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { loadSeedStudent } from "@/lib/events/seed";
import { addComment, COMMENT_MAX_LENGTH, eventComments, loadComments, saveComments } from "@/lib/social/comments";
import { demoViewer } from "@/lib/social/viewer";

// GET: what people are saying about the event, newest first.
// POST { text, replyTo?, mention? }: the demo viewer adds a comment, or a reply in the thread of comment
// replyTo; mention is the name of the person answered.

const CommentSchema = z.object({
  text: z.string().trim().min(1, "Say something first").max(COMMENT_MAX_LENGTH),
  replyTo: z.string().min(1).optional(),
  mention: z.string().trim().min(1).max(40).optional(),
});

export async function GET(_request: NextRequest, context: RouteContext<"/api/social/events/[id]/comments">) {
  const { id } = await context.params;
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  await loadComments(event.id);
  return Response.json({ data: eventComments(event, demoViewer().id), error: null });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/social/events/[id]/comments">) {
  const { id } = await context.params;
  const body = await readJsonBody(request, CommentSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = demoViewer();
  await loadComments(event.id);
  const { replyTo } = body.data;
  if (replyTo && !eventComments(event, viewer.id).comments.some((comment) => comment.id === replyTo && !comment.replyTo)) {
    return Response.json({ data: null, error: "That comment is gone" }, { status: 400 });
  }
  addComment(event, { id: viewer.id, name: loadSeedStudent().name.split(" ")[0] ?? "You" }, body.data.text, new Date(), replyTo, body.data.mention);
  await saveComments(event.id);
  return Response.json({ data: eventComments(event, viewer.id), error: null });
}
