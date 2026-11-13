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
  return (
    <>
      {POSTS.map((post) => (
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
              <CloseIcon className="ml-[8px] h-[20px] w-[20px] shrink-0 text-muted" />
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
