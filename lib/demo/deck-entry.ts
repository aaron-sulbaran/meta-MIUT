// Where a stepped beat (a deck, a film, the opening's slides) starts when the stage lands on it.
// Only a single Back from the next beat enters it at its last step, so Back from P2 shows
// P1's ending. Everything else starts at the first step: Next, a jump (a dot, Home, a remote
// goto), and a fresh run, which puts every stage back on P1's first step (the QR) whatever
// beat it was on before.
export function entersAtLastStep(from: number, to: number, freshRun = false): boolean {
  return !freshRun && to === from - 1;
}

// How a stage applies a move it did not make. Another stage tab's move (by "stage", over the
// store or this browser's channel) is a beat move: a stage that only follows goes to that beat
// and never steps its own deck or writes a position back, so it can never pull the show back.
// The remote's Next and Back and a presenter phone (by "control", or an older record without
// `by`) step a deck or film on screen first, as the presenter's own keys do.
export function followsAsBeatMove(by: "stage" | "control" | undefined): boolean {
  return by === "stage";
}

// A remote move this stage has not applied yet, already put back by another stage that stepped
// its deck instead: true when it was one beat from where this stage is, so this stage steps its
// own deck or film for it too. `seen` is the newest control seq this stage has applied.
export function catchesUpOnRemoteStep(
  control: { seq: number; from: number; to: number } | undefined,
  seen: number,
  here: number,
): boolean {
  return control !== undefined && control.seq > seen && control.from === here && Math.abs(control.to - control.from) === 1;
}
