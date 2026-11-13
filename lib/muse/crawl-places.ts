// Named spots a student can say ("then Baker at 7"). Muse picks from these by name; it never
// invents coordinates. Event venues are added at request time.
export type CrawlPlace = { name: string; lat: number; lng: number; aliases: string[] };

export const CRAWL_PLACES: CrawlPlace[] = [
  { name: "Stata Center", lat: 42.3616, lng: -71.0906, aliases: ["stata"] },
  { name: "Killian Court", lat: 42.3597, lng: -71.0921, aliases: ["killian", "building 10", "infinite"] },
  { name: "Student Center", lat: 42.3591, lng: -71.0947, aliases: ["student center", "stud"] },
  { name: "Simmons Hall", lat: 42.357, lng: -71.1012, aliases: ["simmons"] },
  { name: "Baker House", lat: 42.3566, lng: -71.0956, aliases: ["baker"] },
  { name: "MacGregor House", lat: 42.3555, lng: -71.0996, aliases: ["macgregor"] },
  { name: "Next House", lat: 42.3547, lng: -71.1035, aliases: ["next house"] },
  { name: "Maseeh Hall", lat: 42.3575, lng: -71.0934, aliases: ["maseeh"] },
  { name: "New Vassar", lat: 42.3594, lng: -71.0988, aliases: ["new vassar"] },
  { name: "East Campus", lat: 42.3601, lng: -71.0866, aliases: ["east campus"] },
  { name: "MIT Museum", lat: 42.36226, lng: -71.08679, aliases: ["mit museum"] },
  { name: "Kendall Square", lat: 42.3626, lng: -71.0843, aliases: ["kendall"] },
  { name: "Central Square", lat: 42.3654, lng: -71.1037, aliases: ["central square", "central"] },
  { name: "Harvard Square", lat: 42.3734, lng: -71.1189, aliases: ["harvard"] },
];
