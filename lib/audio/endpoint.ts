// Hears when a spoken question is over: speech, then a pause of PAUSE_MS.
// The first CALIBRATE_MS set the room's noise floor, so quiet rooms and noisy ones both work.
// The floor is capped at FLOOR_CEILING: speech or crowd noise at the tap cannot set it so high
// that the speech after it never counts (it then just keeps listening until tapped to send).

export const PAUSE_MS = 1300;
export const NO_SPEECH_MS = 12000;
const CALIBRATE_MS = 300;
const MIN_LEVEL = 0.012;
const FLOOR_CEILING = 0.02;
const MIN_SPEECH_MS = 250;

export type EndpointState = "waiting" | "speaking" | "done" | "no-speech";

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length);
}

export function createEndpointer(sampleRate: number) {
  let elapsed = 0;
  let floor = 0;
  let floorChunks = 0;
  let spoken = 0;
  let quiet = 0;
  let state: EndpointState = "waiting";

  return function push(chunk: Float32Array): EndpointState {
    if (state === "done" || state === "no-speech") return state;
    const ms = (chunk.length / sampleRate) * 1000;
    const level = rms(chunk);
    elapsed += ms;
    if (elapsed <= CALIBRATE_MS) {
      floor = Math.min(FLOOR_CEILING, (floor * floorChunks + level) / ++floorChunks);
      return state;
    }
    const loud = level > Math.max(MIN_LEVEL, floor * 3);
    if (loud) {
      spoken += ms;
      quiet = 0;
      if (spoken >= MIN_SPEECH_MS) state = "speaking";
    } else {
      quiet += ms;
    }
    if (state === "speaking" && quiet >= PAUSE_MS) state = "done";
    else if (state === "waiting" && elapsed >= NO_SPEECH_MS) state = "no-speech";
    return state;
  };
}
