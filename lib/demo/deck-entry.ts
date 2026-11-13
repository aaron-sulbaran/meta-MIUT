// Where a stepped beat (a deck, a film, the opening's slides) starts when the stage lands on it.
// Only a single Back from the next beat enters it at its last step, so Back from P2 shows
// P1's ending. Everything else starts at the first step: Next, a jump (a dot, Home, a remote
// goto), and a fresh run, which puts every stage back on P1's first step (the QR) whatever
// beat it was on before.
export function entersAtLastStep(from: number, to: number, freshRun = false): boolean {
  return !freshRun && to === from - 1;
}
