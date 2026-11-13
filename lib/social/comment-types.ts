// Event comments shapes, client-safe.

export const COMMENT_MAX_LENGTH = 280;

export type EventComment = {
  id: string;
  authorId: string;
  name: string;
  text: string;
  /** ISO time it was posted. */
  at: string;
  /** Posted by the viewer. */
  mine: boolean;
  /** The comment this one answers; replies show under it, oldest first. */
  replyTo?: string;
  /** Name of the person this reply answers, shown in blue before the text, like Facebook. */
  mention?: string;
};

export type EventComments = { eventId: string; comments: EventComment[] };
