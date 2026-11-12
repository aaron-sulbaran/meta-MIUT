import type { Category } from "@/lib/map/category";

// Map stickers: small flat illustrations, one per category, in the style of
// die-cut stickers on a map. The white outline and shadow come from
// STICKER_FILTER, applied to the element that holds the SVG. Kept as SVG
// strings because map markers are plain DOM owned by MapLibre, not React.

const svg = (body: string) => `<svg viewBox="0 0 48 48" aria-hidden="true" style="display:block;width:100%;height:100%">${body}</svg>`;

export const STICKER_FILTER =
  "drop-shadow(1.6px 0 0 #fff) drop-shadow(-1.6px 0 0 #fff) drop-shadow(0 1.6px 0 #fff) drop-shadow(0 -1.6px 0 #fff) drop-shadow(0 2px 2.5px rgba(0,0,0,0.28))";

export const CATEGORY_STICKERS: Record<Category, string> = {
  pizza: svg(
    '<path d="M6 12c11-6 25-6 36 0L24 44Z" fill="#ffcf4a"/><path d="M6 12c11-6 25-6 36 0l-2.6 4.4C29.6 11.2 18.4 11.2 8.6 16.4Z" fill="#e39a3b"/><circle cx="19" cy="21" r="3.4" fill="#e2483b"/><circle cx="29" cy="23" r="3" fill="#e2483b"/><circle cx="24" cy="32" r="2.8" fill="#e2483b"/><circle cx="25" cy="17" r="1.2" fill="#3f9b4b"/><circle cx="21" cy="27" r="1.1" fill="#3f9b4b"/>',
  ),
  taco: svg(
    '<path d="M6 34a18 18 0 0 1 36 0Z" fill="#f2b84b"/><path d="M9 28c2-3 4 0 6-3s4 0 6-3 4 0 6-3 4 0 6 3 4 0 6 3" fill="none" stroke="#5cb85c" stroke-width="4" stroke-linecap="round"/><circle cx="17" cy="23" r="2" fill="#e2483b"/><circle cx="28" cy="21" r="2" fill="#e2483b"/><path d="M6 34a18 18 0 0 1 36 0" fill="none" stroke="#d99a2b" stroke-width="2.5"/>',
  ),
  boba: svg(
    '<path d="M30 3 25 16" stroke="#ff6fa3" stroke-width="3.2" stroke-linecap="round"/><path d="M12 15h24l-3 29H15Z" fill="#e9c79e"/><path d="M10 13h28a3 3 0 0 1 0 4H10a3 3 0 0 1 0-4Z" fill="#fff" stroke="#d9c3a5" stroke-width="1"/><circle cx="19" cy="38" r="2.4" fill="#3b2a24"/><circle cx="25" cy="39" r="2.4" fill="#3b2a24"/><circle cx="29" cy="35" r="2.3" fill="#3b2a24"/><circle cx="22" cy="34" r="2.3" fill="#3b2a24"/>',
  ),
  coffee: svg(
    '<ellipse cx="22" cy="40" rx="16" ry="4" fill="#d9e3ea"/><path d="M8 18h28v12a10 10 0 0 1-10 10h-8A10 10 0 0 1 8 30Z" fill="#fff" stroke="#cfd8de" stroke-width="1.2"/><ellipse cx="22" cy="18.5" rx="13" ry="3" fill="#8a5a3c"/><path d="M36 21h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#cfd8de" stroke-width="3"/><path d="M17 5c-2 3 2 5 0 8M24 4c-2 3 2 5 0 8" stroke="#b7c2c9" stroke-width="2" fill="none" stroke-linecap="round"/>',
  ),
  meal: svg(
    '<path d="M18 9c-1 3 2 4 0 7M25 8c-1 3 2 4 0 7M32 9c-1 3 2 4 0 7" stroke="#b7c2c9" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M5 22h38a19 19 0 0 1-38 0Z" fill="#ff8a3d"/><path d="M5 22h38" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/><path d="M12 22c3-3 6 0 9-3s6 0 9-3 6 0 8 2" fill="none" stroke="#fff3c4" stroke-width="2.4" stroke-linecap="round"/>',
  ),
  climb: svg(
    '<path d="M3 42 18 14l8 12 5-7 14 23Z" fill="#7b8fa6"/><path d="M18 14l-4.4 8.2 4.4-2 4 3.2 1.8-3.3Z" fill="#fff"/><path d="M31 19l-2.6 3.6 2.6-.8 2.6 1.8Z" fill="#fff"/><path d="M18 14V4" stroke="#3b3b3b" stroke-width="1.6"/><path d="M18 4h9l-2.4 3 2.4 3h-9Z" fill="#e2483b"/>',
  ),
  yoga: svg(
    '<path d="M24 40c-5-5-7-12-1-23 1-1 2-1 2 0 6 11 4 18-1 23Z" fill="#ff8fb8"/><path d="M23 41C14 39 8 32 8 23c0-1 1-1 2-1 9 2 14 9 13 19Z" fill="#c879e6"/><path d="M25 41c9-2 15-9 15-18 0-1-1-1-2-1-9 2-14 9-13 19Z" fill="#c879e6"/><path d="M10 43h28" stroke="#5cb85c" stroke-width="3" stroke-linecap="round"/>',
  ),
  film: svg(
    '<path d="M11 18h26l-4 26H15Z" fill="#fff"/><path d="M15.5 18l2 26h4l-.6-26ZM26.7 18l-.6 26h4l2-26Z" fill="#e2483b"/><circle cx="14" cy="15" r="5" fill="#fff4cf"/><circle cx="21" cy="11" r="5.5" fill="#ffe9a3"/><circle cx="28" cy="12" r="5" fill="#fff4cf"/><circle cx="34" cy="16" r="4.6" fill="#ffe9a3"/><circle cx="24" cy="17" r="4.5" fill="#fff4cf"/>',
  ),
  music: svg(
    '<path d="M18 36V10l22-5v26" fill="none" stroke="#7c5cff" stroke-width="4" stroke-linejoin="round"/><path d="M18 10l22-5v7l-22 5Z" fill="#7c5cff"/><ellipse cx="12.5" cy="36.5" rx="6.5" ry="5" fill="#9b84ff"/><ellipse cx="34.5" cy="31.5" rx="6.5" ry="5" fill="#9b84ff"/>',
  ),
  code: svg(
    '<rect x="7" y="9" width="34" height="23" rx="3" fill="#2b3240"/><rect x="10" y="12" width="28" height="17" rx="1.5" fill="#1d2330"/><path d="m19 16-4 4.5 4 4.5M29 16l4 4.5-4 4.5M25.5 14.5l-3 12" fill="none" stroke="#3ddc97" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 34h42l-3 5H6Z" fill="#9aa5b5"/>',
  ),
  study: svg(
    '<rect x="8" y="33" width="32" height="8" rx="1.5" fill="#4a7bd0"/><rect x="11" y="25" width="28" height="8" rx="1.5" fill="#f2b84b"/><rect x="7" y="17" width="30" height="8" rx="1.5" fill="#e2483b"/><path d="M11 37h24M14 29h20M10 21h22" stroke="#fff" stroke-width="1.4" opacity=".7"/><path d="M30 6l8 3-8 3-8-3Z" fill="#2b3240"/><path d="M38 9v5" stroke="#2b3240" stroke-width="1.4"/>',
  ),
  career: svg(
    '<path d="M18 13v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" fill="none" stroke="#8a5a3c" stroke-width="3"/><rect x="5" y="13" width="38" height="27" rx="4" fill="#b9773f"/><path d="M5 23h38" stroke="#8a5a3c" stroke-width="2"/><rect x="21" y="20" width="6" height="6" rx="1" fill="#ffd166"/>',
  ),
  event: svg(
    '<path d="M24 4l6 12.4 13.6 2-9.8 9.6 2.3 13.6L24 35.2l-12.1 6.4 2.3-13.6-9.8-9.6 13.6-2Z" fill="#ffd23f"/><circle cx="19.5" cy="23" r="1.8" fill="#3b2a24"/><circle cx="28.5" cy="23" r="1.8" fill="#3b2a24"/><path d="M20 28c2.4 2.4 5.6 2.4 8 0" fill="none" stroke="#3b2a24" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.5" cy="27" r="1.6" fill="#ff9aa2" opacity=".8"/><circle cx="31.5" cy="27" r="1.6" fill="#ff9aa2" opacity=".8"/>',
  ),
};

/** Soft background behind a sticker on cards. */
export const CATEGORY_TINTS: Record<Category, string> = {
  pizza: "#fff3d6",
  taco: "#fff1d9",
  boba: "#f7ece0",
  coffee: "#eef2f5",
  meal: "#ffeadb",
  climb: "#e7eef6",
  yoga: "#f6e8fb",
  film: "#ffe6e4",
  music: "#ece7ff",
  code: "#e3f7ee",
  study: "#e6eefb",
  career: "#f6ebe0",
  event: "#fff7d1",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  pizza: "Pizza",
  taco: "Tacos",
  boba: "Boba",
  coffee: "Coffee",
  meal: "Food",
  climb: "Climbing",
  yoga: "Yoga",
  film: "Film",
  music: "Music",
  code: "Build",
  study: "Study",
  career: "Career",
  event: "Event",
};
