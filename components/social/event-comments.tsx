"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/social/whos-going";
import { COMMENT_MAX_LENGTH, type EventComment, type EventComments } from "@/lib/social/comment-types";

// The event page's Comments section: what people are saying about the event
// (is there food left, how full is it), newest first, and a box to add yours.
// Backed by GET and POST /api/social/events/[id]/comments (t-k42f).

const SHOWN = 4;

function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function EventCommentsSection({ initial }: { initial: EventComments }) {
  const [comments, setComments] = useState<EventComment[]>(initial.comments);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [replyingTo, setReplyingTo] = useState<EventComment | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function startReply(to: EventComment) {
    setReplyingTo(to);
    setError(null);
    input.current?.focus();
  }

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/social/events/${encodeURIComponent(initial.eventId)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body, replyTo: replyingTo?.id }),
      });
      const result = (await response.json()) as { data: EventComments | null; error: string | null };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Could not post");
      setComments(result.data.comments);
      setNow(Date.now());
      setText("");
      setReplyingTo(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not post");
    } finally {
      setSending(false);
    }
  }

  const threads = comments.filter((comment) => !comment.replyTo);
  const shownThreads = all ? threads : threads.slice(0, SHOWN);
  const repliesTo = (id: string) => comments.filter((comment) => comment.replyTo === id);
  return (
    <section aria-labelledby="comments-heading" className="px-3 pb-6">
      <h2 id="comments-heading" className="font-display text-title font-bold">
        Comments{comments.length > 0 && <span className="ml-[6px] text-label font-semibold text-muted">{comments.length}</span>}
      </h2>
      {replyingTo && (
        <p className="mt-[10px] flex items-center gap-[6px] text-meta text-muted">
          <span>
            Replying to <span className="font-semibold text-ink">{replyingTo.mine ? "yourself" : replyingTo.name}</span>
          </span>
          <button type="button" onClick={() => setReplyingTo(null)} className="font-semibold">
            Cancel
          </button>
        </p>
      )}
      <form onSubmit={send} className={`${replyingTo ? "mt-[6px]" : "mt-[10px]"} flex items-center gap-2`}>
        <input
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={replyingTo ? `Reply to ${replyingTo.mine ? "your comment" : replyingTo.name}...` : "How is it going? Food left?"}
          aria-label={replyingTo ? "Write a reply" : "Write a comment"}
          className="min-w-0 flex-1 rounded-full bg-wash px-[14px] py-[8px] text-body outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="shrink-0 rounded-full bg-primary px-[14px] py-[8px] text-meta font-semibold text-on-primary disabled:opacity-40"
        >
          {sending ? "Posting" : "Post"}
        </button>
      </form>
      {error && <p className="mt-[6px] text-meta text-muted">{error}</p>}
      {comments.length === 0 ? (
        <p className="mt-[12px] text-body text-muted">No comments yet. Be the first to say how it is going.</p>
      ) : (
        <ul className="mt-[12px] flex flex-col gap-[12px]">
          {shownThreads.map((comment) => {
            const replies = repliesTo(comment.id);
            return (
              <li key={comment.id}>
                <CommentRow comment={comment} now={now} onReply={() => startReply(comment)} />
                {replies.length > 0 && (
                  <ul className="mt-[8px] flex flex-col gap-[8px] pl-[42px]">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentRow comment={reply} now={now} small onReply={() => startReply(comment)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {threads.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className="mt-[10px] text-meta font-semibold text-muted">
          {all ? "Show fewer comments" : `See all ${comments.length} comments`}
        </button>
      )}
    </section>
  );
}

function CommentRow({
  comment,
  now,
  small = false,
  onReply,
}: {
  comment: EventComment;
  now: number;
  small?: boolean;
  onReply: () => void;
}) {
  return (
    <div className="flex items-start gap-[10px]">
      <Avatar person={{ id: comment.authorId, name: comment.name }} size={small ? 24 : 32} />
      <div className="min-w-0">
        <div className="rounded-[16px] bg-wash px-[12px] py-[8px]">
          <p className="text-meta font-semibold text-ink">{comment.mine ? "You" : comment.name}</p>
          <p className="text-body">{comment.text}</p>
        </div>
        <p className="mt-[3px] flex gap-[12px] pl-[12px] text-meta text-muted">
          <span>{ago(comment.at, now)}</span>
          <button type="button" onClick={onReply} aria-label={`Reply to ${comment.mine ? "your comment" : comment.name}`} className="font-semibold">
            Reply
          </button>
        </p>
      </div>
    </div>
  );
}
