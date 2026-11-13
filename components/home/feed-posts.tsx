"use client";

import { useState } from "react";
import {
  CloseIcon,
  CommentIcon,
  GlobeIcon,
  LikeIcon,
  MoreDotsIcon,
  ShareIcon,
} from "@/components/ui/icons";
import { FeedSeparator } from "@/components/ui/card";

// PLACEHOLDER: mock News Feed posts so Home reads like Facebook below the
// events. Invented authors; nature photos from Unsplash (Unsplash License).

type Post = {
  id: string;
  author: string;
  /** Square tile for a group or page, round for a person. */
  kind: "person" | "group";
  color: string;
  context?: string;
  action?: "Follow" | "Join";
  time: string;
  text: string;
  photos: string[];
  likes: string;
  comments: string;
  shares: string;
};

const POSTS: Post[] = [
  {
    id: "outing-club",
    author: "MIT Outing Club",
    kind: "group",
    color: "#2f6b3a",
    context: "Maya",
    action: "Join",
    time: "3h",
    text: "Sunrise from the summit this morning. Worth the 4 AM start. Next trip leaves Saturday, sign up in the group.",
    photos: ["/feed/mountains-clouds.jpg"],
    likes: "1.2K",
    comments: "84",
    shares: "31",
  },
  {
    id: "leo-trail",
    author: "Leo",
    kind: "person",
    color: "#6d4bd1",
    time: "5h",
    text: "Found a quiet trail in the Fells, 20 minutes from campus. Perfect study break.",
    photos: ["/feed/forest-path.jpg"],
    likes: "312",
    comments: "27",
    shares: "4",
  },
  {
    id: "new-england-outdoors",
    author: "New England Outdoors",
    kind: "group",
    color: "#1f5f8b",
    action: "Follow",
    time: "1d",
    text: "Fall colors are almost gone. Catch the waterfalls while the water is still high.",
    photos: ["/feed/waterfall.jpg"],
    likes: "27.7K",
    comments: "171",
    shares: "478",
  },
  {
    id: "priya-break",
    author: "Priya",
    kind: "person",
    color: "#c2410c",
    time: "Oct 20",
    text: "Fall break recap: one lake, one beach, zero problem sets.",
    photos: ["/feed/lake-boat.jpg", "/feed/beach.jpg", "/feed/peak.jpg"],
    likes: "486",
    comments: "39",
    shares: "6",
  },
];

/** Shown in place of a post the student hides with the X, so the feed never runs dry. */
const MORE_POSTS: Post[] = [
  {
    id: "sailing-pavilion",
    author: "MIT Sailing",
    kind: "group",
    color: "#0e7490",
    action: "Follow",
    time: "2h",
    text: "Last open sail of the season this weekend. Calm water, no experience needed.",
    photos: ["/feed/lake-boat.jpg"],
    likes: "908",
    comments: "52",
    shares: "17",
  },
  {
    id: "sam-pset",
    author: "Sam",
    kind: "person",
    color: "#be185d",
    time: "4h",
    text: "Just submitted the pset 3 minutes before the deadline. Going to sleep for a week.",
    photos: [],
    likes: "141",
    comments: "33",
    shares: "1",
  },
  {
    id: "hiking-club",
    author: "Boston Hiking Club",
    kind: "group",
    color: "#4d7c0f",
    context: "Leo",
    action: "Join",
    time: "6h",
    text: "Peak foliage is over, but the views are not. Day trip to the White Mountains on Sunday.",
    photos: ["/feed/peak.jpg"],
    likes: "2.4K",
    comments: "96",
    shares: "58",
  },
  {
    id: "nina-beach",
    author: "Nina",
    kind: "person",
    color: "#7c3aed",
    time: "2d",
    text: "Missing this already. Who is up for one more beach day before it gets cold?",
    photos: ["/feed/beach.jpg"],
    likes: "264",
    comments: "18",
    shares: "2",
  },
  {
    id: "waterfall-walk",
    author: "Maya",
    kind: "person",
    color: "#b45309",
    time: "3d",
    text: "Twenty minute walk, one very loud waterfall. Highly recommend.",
    photos: ["/feed/waterfall.jpg", "/feed/forest-path.jpg", "/feed/mountains-clouds.jpg"],
    likes: "377",
    comments: "21",
    shares: "3",
  },
];

function Avatar({ post }: { post: Post }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: post.color }}
      className={`flex h-[39px] w-[39px] shrink-0 items-center justify-center font-display text-[17px] font-bold text-white ${
        post.kind === "group" ? "rounded-[9px]" : "rounded-full"
      }`}
    >
      {post.author.charAt(0)}
    </span>
  );
}

function Photos({ photos }: { photos: string[] }) {
  const [first, ...rest] = photos;
  if (!first) return null;
  if (rest.length === 0) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={first} alt="" className="mt-[10px] block max-h-[480px] w-full object-cover" />;
  }
  return (
    <div className="mt-[10px] grid grid-cols-2 gap-[3px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={first} alt="" className="col-span-2 block aspect-[3/2] w-full object-cover" />
      {rest.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className="block aspect-square w-full object-cover" />
      ))}
    </div>
  );
}

export function FeedPosts() {
  const [shown, setShown] = useState(POSTS);
  const [queue, setQueue] = useState(MORE_POSTS);

  // The X hides a post and the next one in line takes its place.
  function hide(id: string) {
    const [next, ...rest] = queue;
    const hidden = shown.find((post) => post.id === id);
    if (!next || !hidden) return;
    setShown([...shown.filter((post) => post.id !== id), next]);
    setQueue([...rest, hidden]);
  }

  return (
    <>
      {shown.map((post) => (
        <div key={post.id}>
          <article className="pt-[11px]" aria-label={`Post by ${post.author}`}>
            <div className="flex items-center gap-[9px] px-[11.4px]">
              <Avatar post={post} />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline gap-[4px] font-display text-label font-bold">
                  <span className="truncate">{post.author}</span>
                  {post.action && (
                    <span className="shrink-0 font-sans font-semibold text-link">· {post.action}</span>
                  )}
                </p>
                <p className="flex items-center gap-[4px] text-meta font-semibold text-muted">
                  {post.context && <span className="truncate">{post.context} ·</span>}
                  {post.time} · <GlobeIcon className="h-[12px] w-[12px]" />
                </p>
              </div>
              <MoreDotsIcon className="h-[20px] w-[20px] shrink-0 text-muted" />
              <button
                type="button"
                aria-label={`Hide post by ${post.author}`}
                onClick={() => hide(post.id)}
                className="ml-[8px] shrink-0 text-muted"
              >
                <CloseIcon className="h-[20px] w-[20px]" />
              </button>
            </div>
            <p className="px-[11.4px] pt-[10px] text-body font-medium">{post.text}</p>
            <Photos photos={post.photos} />
            <div className="flex items-center gap-[22px] px-[11.4px] py-[10px] text-[14px] font-semibold text-muted">
              <span className="flex items-center gap-[6px]">
                <LikeIcon className="h-[20px] w-[20px]" />
                {post.likes}
              </span>
              <span className="flex items-center gap-[6px]">
                <CommentIcon className="h-[20px] w-[20px]" />
                {post.comments}
              </span>
              <span className="flex items-center gap-[6px]">
                <ShareIcon className="h-[20px] w-[20px]" />
                {post.shares}
              </span>
            </div>
          </article>
          <FeedSeparator />
        </div>
      ))}
    </>
  );
}
