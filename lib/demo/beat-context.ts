import { ACT_CAST, BEATS, CAST_SLUG, STORY_DUE_AFTER, type Beat, type BeatContext, type CastId } from "@/lib/demo/beats";

// What a beat puts on a phone, and who may move the stage from their own phone.
// Client safe. The presenter phones (/demo/phone/<slug>) use it; the /demo
// stage builds the same paths and could use beatScreen and inFrameMessage too.

// Each presenter's personal link: /demo/phone/<slug> (slugs live with the cast in beats.ts).
export const PHONE_SLUG: Record<CastId, string> = CAST_SLUG;

export const PHONE_CAST = Object.keys(PHONE_SLUG) as CastId[];

export function castFromSlug(slug: string): CastId | null {
  return PHONE_CAST.find((id) => PHONE_SLUG[id] === slug.toLowerCase()) ?? null;
}

export function phonePath(id: CastId): string {
  return `/demo/phone/${PHONE_SLUG[id]}`;
}

/** Whose beat it is: the cast member the beat's act follows, or null for the pitch beats. */
export function beatCast(beat: Beat | undefined): CastId | null {
  if (!beat || beat.act === "pitch") return null;
  return ACT_CAST[beat.act];
}

/** True once the stage loads the story event (after the organizer act). */
export function storyDue(index: number): boolean {
  return index > STORY_DUE_AFTER;
}

/** The screen a beat loads in the phone, or null (a film, or waiting for the story event). */
export function beatScreen(beat: Beat, context: BeatContext): string | null {
  if (beat.kind !== "staged" && beat.kind !== "app") return null;
  return beat.path?.(context) ?? null;
}

/**
 * When the phone is still on the screen of the beat this one continues from,
 * the message to post into it instead of loading this beat's path (U1c asks
 * Muse over the walk already drawn). Null means load the path.
 */
export function inFrameMessage(beat: Beat, location: string | null, context: BeatContext, beats: Beat[] = BEATS) {
  if (!beat.inFrame || !location) return null;
  const from = beats.find((candidate) => candidate.id === beat.inFrame?.from);
  const fromSrc = from ? beatScreen(from, context) : null;
  return fromSrc && fromSrc === location ? beat.inFrame.message : null;
}

/** The next person after the one on now (or the first person, before the show starts). */
export function nextCast(index: number, beats: Beat[] = BEATS): CastId | null {
  const now = beatCast(beats[index]);
  for (let at = index + 1; at < beats.length; at += 1) {
    const cast = beatCast(beats[at]);
    if (cast && cast !== now) return cast;
  }
  return null;
}

export type PhoneView =
  | { kind: "scene"; beat: Beat; lastOfAct: boolean; handsTo: CastId | null }
  | { kind: "waiting"; onNow: CastId | null; upNext: boolean; canJoin: boolean; phase: "before" | "during" | "after" };

/** What `cast`'s phone shows while the stage is on beat `index`. */
export function phoneView(index: number, cast: CastId, beats: Beat[] = BEATS): PhoneView {
  const beat = beats[index];
  const onNow = beatCast(beat);
  if (beat && onNow === cast) {
    const following = beatCast(beats[index + 1]);
    return { kind: "scene", beat, lastOfAct: following !== cast, handsTo: following !== cast ? nextCast(index, beats) : null };
  }
  const anyoneLater = beats.slice(index + 1).some((later) => beatCast(later) !== null);
  const anyoneBefore = beats.slice(0, index).some((earlier) => beatCast(earlier) !== null);
  const phase = onNow ? "during" : !anyoneBefore ? "before" : anyoneLater ? "during" : "after";
  return { kind: "waiting", onNow, upNext: nextCast(index, beats) === cast, canJoin: canJoinAt(index, cast, beats), phase };
}

/**
 * True when `cast` may start their own act from their own phone: the stage rests
 * on the last beat of someone else's act and the very next beat is theirs (the
 * hand-over moment: Jolyn's lock screen alert, Lisa's invite, Trish's Instagram).
 */
export function canJoinAt(index: number, cast: CastId, beats: Beat[] = BEATS): boolean {
  const onNow = beatCast(beats[index]);
  return onNow !== null && onNow !== cast && beatCast(beats[index + 1]) === cast;
}

/** The first beat of the next person's act after beat `index`, or null when nobody follows. */
export function nextActStart(index: number, beats: Beat[] = BEATS): number | null {
  const now = beatCast(beats[index]);
  for (let at = index + 1; at < beats.length; at += 1) {
    const cast = beatCast(beats[at]);
    if (cast && cast !== now) return at;
  }
  return null;
}

export type PhoneMove = { action: "next" | "back" | "join" | "pass"; from: CastId; at: number };
export type PhoneMoveDecision = { ok: true; index: number } | { ok: false; reason: string };

/**
 * Whether a presenter's phone may move the stage. The person whose beat it is
 * moves it; Next from the last beat of their act hands over to the next person;
 * Back stays inside their act. "join" is the next person taking the hand-over
 * from their own phone: allowed only while the stage rests on the last beat of
 * the act before theirs (canJoinAt), and it moves to their first beat. "pass" is
 * a screen of the person on now handing the show on from any beat of their act
 * (Lisa's "Open to company", Jolyn's "Sent to Lisa"): it moves to the next
 * person's first beat. `at` is the beat the phone saw, so a
 * repeated tap or a move the laptop already made does nothing twice.
 */
export function decidePhoneMove(current: number, move: PhoneMove, beats: Beat[] = BEATS): PhoneMoveDecision {
  if (move.at !== current) return { ok: false, reason: "The stage has already moved" };
  if (move.action === "join") {
    return canJoinAt(current, move.from, beats) ? { ok: true, index: current + 1 } : { ok: false, reason: "It is not your turn yet" };
  }
  if (beatCast(beats[current]) !== move.from) return { ok: false, reason: "It is not your beat" };
  if (move.action === "pass") {
    const start = nextActStart(current, beats);
    return start === null ? { ok: false, reason: "Nobody is on after you" } : { ok: true, index: start };
  }
  if (move.action === "next") {
    return current + 1 < beats.length ? { ok: true, index: current + 1 } : { ok: false, reason: "That was the last beat" };
  }
  if (current === 0 || beatCast(beats[current - 1]) !== move.from) return { ok: false, reason: "This is your first beat" };
  return { ok: true, index: current - 1 };
}
