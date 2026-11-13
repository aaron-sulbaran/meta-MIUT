import { CAST, type CastId } from "@/lib/demo/beats";

// A cast member's drawn profile picture for the stage: a soft gradient with
// their initial, one color per person so the room can tell them apart.

const FACES: Record<CastId, string> = {
  organizer: "linear-gradient(140deg, #ffe08a 0%, #f7b84b 55%, #e08a2c 100%)",
  user1: "linear-gradient(140deg, #c9e4ff 0%, #8fb8f2 55%, #5b86d6 100%)",
  user2: "linear-gradient(140deg, #ffd3b6 0%, #f6a28b 55%, #d97a6c 100%)",
  user3: "linear-gradient(140deg, #d6f5d6 0%, #8fd3a0 55%, #4fa874 100%)",
};

export function CastAvatar({ id, size }: { id: CastId; size: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{ width: size, height: size, background: FACES[id], fontSize: Math.round(size * 0.42) }}
    >
      {CAST[id].name.charAt(0)}
    </span>
  );
}
