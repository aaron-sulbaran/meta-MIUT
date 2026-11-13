// A logo for an organizer that has none (Lisa): a colored circle with a white
// icon for what the group does, picked from words in its name ("Boston Student
// Runners" gets a sneaker, "Cambridge Coffee Collective" a cup, "MIT Media
// Lab" a flask). Groups whose name says nothing get a sparkle, in a color
// fixed by the name so the same group always looks the same. Returned as an
// SVG data URL, so it works anywhere a logo URL does (map bubbles, cards,
// Top 3, the crawl popup) with no file to host.

type Glyph = { color: string; paths: string[]; dots?: string };

const GLYPHS: Record<string, Glyph> = {
  coffee: {
    color: "#8a5a3b",
    paths: ["M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z", "M16 11h1.5a2.5 2.5 0 0 1 0 5H16", "M8.5 3.5c0 1 1 1.5 1 2.5", "M12.5 3.5c0 1 1 1.5 1 2.5"],
  },
  film: {
    color: "#6b3fa0",
    paths: ["M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z", "M4 10 5 5l15 3-1 2", "M8.5 5.8 10 9", "M13.5 6.8 15 10"],
  },
  run: {
    color: "#e8590c",
    paths: ["M3 16h18v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z", "M3 16c0-3 1-6 3-8l3 2 2-1 2 3c2 1 5 1.5 7 2.5 1 .5 1 1.5 1 1.5", "M9.5 12 11 11", "M11.5 14 13 13"],
  },
  skate: {
    color: "#1c7ed6",
    paths: ["M6 4h5l1 7c3 0 6 1 7 3v2H6Z", "M4 20h16", "M8 16v4", "M17 16v4"],
  },
  idea: {
    color: "#3b5bdb",
    paths: ["M9 18h6", "M10 21h4", "M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z"],
  },
  code: {
    color: "#212529",
    paths: ["M8 8l-4 4 4 4", "M16 8l4 4-4 4", "M13.5 6l-3 12"],
  },
  games: {
    color: "#c92a2a",
    paths: ["M5 5h14v14H5Z"],
    dots: "M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01",
  },
  lab: {
    color: "#0c8599",
    paths: ["M9 3h6", "M10 3v6l-5 9a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 18l-5-9V3", "M7.5 14h9"],
  },
  outdoors: {
    color: "#2b8a3e",
    paths: ["M3 19 9 9l4 6 2-3 6 7Z"],
  },
  home: {
    color: "#1971c2",
    paths: ["M3 11 12 4l9 7", "M5 10v10h5v-6h4v6h5V10"],
  },
  council: {
    color: "#364fc7",
    paths: ["M3 9l9-5 9 5", "M5 10v8", "M9.5 10v8", "M14.5 10v8", "M19 10v8", "M3 20h18"],
  },
  music: {
    color: "#d6336c",
    paths: ["M9 18V6l10-2v12", "M9 18a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 18Z", "M19 16a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 19 16Z"],
  },
  book: {
    color: "#5f3dc4",
    paths: ["M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1Z", "M12 6v14"],
  },
  globe: {
    color: "#087f5b",
    paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Z", "M3 12h18", "M12 3c3 3 3 15 0 18", "M12 3c-3 3-3 15 0 18"],
  },
  food: {
    color: "#f08c00",
    paths: ["M7 3v18", "M5 3v5a2 2 0 0 0 4 0V3", "M17 21V3c-2 1-3 4-3 7h3"],
  },
  art: {
    color: "#ae3ec9",
    paths: ["M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z"],
    dots: "M7.5 11h.01M10 7h.01M14.5 7h.01",
  },
  sparkle: {
    color: "#495057",
    paths: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z", "M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"],
  },
};

// Words in a name, checked in order: the first match picks the icon.
const KEYWORDS: [RegExp, keyof typeof GLYPHS][] = [
  [/coffee|caf[eé]|espresso|tea\b|boba/, "coffee"],
  [/film|cinema|movie|screen/, "film"],
  [/run|5k|marathon|track/, "run"],
  [/skat|rink|hockey|ice\b/, "skate"],
  [/founder|startup|entrepreneur|venture|business|innovat/, "idea"],
  [/hack|code|coding|comput|software|\bcs\b|robot|\bai\b/, "code"],
  [/game|board|tabletop|chess|esport|puzzle/, "games"],
  [/lab\b|media lab|science|research|engineer|physics|chem|bio/, "lab"],
  [/outing|climb|mountain|hik|outdoor|boulder/, "outdoors"],
  [/\bhall\b|house|dorm|residence/, "home"],
  [/council|association|government|senate|\bua\b|\buc\b|class/, "council"],
  [/music|jazz|choir|a cappella|acappella|band|orchestra|sing|dance|tango/, "music"],
  [/book|librar|literat|writ|poetry/, "book"],
  [/international|culture|cultural|global|language|students club/, "globe"],
  [/food|pizza|dumpling|ramen|taco|cook|bake|kitchen/, "food"],
  [/\bart|design|paint|draw|photo/, "art"],
];

// Colors for groups whose name matches nothing, picked by the name.
const FALLBACK_COLORS = ["#495057", "#5c7cfa", "#20c997", "#f76707", "#be4bdb", "#1098ad", "#e64980", "#74b816"];

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Which icon a group's name calls for: a key of GLYPHS ("sparkle" when nothing matches). */
export function logoKindFor(name: string): string {
  const lower = name.toLowerCase();
  return KEYWORDS.find(([pattern]) => pattern.test(lower))?.[1] ?? "sparkle";
}

/** A generated logo for a group with none: an SVG data URL. */
export function generatedLogo(name: string): string {
  const kind = logoKindFor(name);
  const glyph = GLYPHS[kind]!;
  const color = kind === "sparkle" ? FALLBACK_COLORS[hash(name) % FALLBACK_COLORS.length]! : glyph.color;
  const strokes = glyph.paths.map((d) => `<path d="${d}"/>`).join("");
  const dots = glyph.dots ? `<path d="${glyph.dots}" stroke-width="3.2"/>` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<circle cx="24" cy="24" r="24" fill="${color}"/>` +
    `<g transform="translate(11 11) scale(1.08)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${strokes}${dots}</g>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
