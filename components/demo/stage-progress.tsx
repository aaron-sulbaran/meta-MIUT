import { ACT_CAST, BEATS, CAST, type BeatAct } from "@/lib/demo/beats";

// The stage's progress: the four people as labeled segments with a dot per
// beat, the current beat filled. The pitch slides sit as lone dots at the ends.

type Group = { act: BeatAct; indexes: number[] };

const GROUPS: Group[] = BEATS.reduce<Group[]>((groups, beat, index) => {
  const last = groups.at(-1);
  if (last && last.act === beat.act) last.indexes.push(index);
  else groups.push({ act: beat.act, indexes: [index] });
  return groups;
}, []);

function Dot({ state }: { state: "done" | "current" | "ahead" }) {
  const look = state === "current" ? "h-[10px] w-[10px] bg-primary" : state === "done" ? "h-[7px] w-[7px] bg-[#bcc0c4]" : "h-[7px] w-[7px] border border-[#bcc0c4]";
  return <span aria-hidden className={`rounded-full ${look}`} />;
}

export function StageProgress({ index }: { index: number }) {
  return (
    <ol aria-label="Where the show is" className="flex items-end justify-center gap-[18px]">
      {GROUPS.map((group) => {
        const here = group.indexes.includes(index);
        const dots = group.indexes.map((beatIndex) => (
          <Dot key={beatIndex} state={beatIndex === index ? "current" : beatIndex < index ? "done" : "ahead"} />
        ));
        if (group.act === "pitch") {
          return (
            <li key={`pitch-${group.indexes[0]}`} className="flex h-[16px] items-center gap-[6px]">
              {dots}
            </li>
          );
        }
        return (
          <li key={group.act} className="flex flex-col items-center gap-[5px]" aria-current={here ? "step" : undefined}>
            <span className={`text-[13px] leading-none font-medium ${here ? "text-ink" : "text-muted"}`}>{CAST[ACT_CAST[group.act]].name}</span>
            <span className={`flex h-[16px] items-center gap-[6px] rounded-full px-[8px] ${here ? "bg-primary-soft" : "bg-[#f0f2f5]"}`}>{dots}</span>
          </li>
        );
      })}
    </ol>
  );
}
