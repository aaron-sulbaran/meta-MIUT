// Muse's spoken voice on the map conversation: the browser's most humanlike
// English voice (the Meta Model API has no text to speech), the same choice
// Ask Muse makes. Short lines only; a new line cuts off the last.

const HUMANLIKE = [/natural|neural/i, /premium|enhanced|siri/i, /google us english/i, /\b(ava|aria|jenny|samantha|zoe|allison)\b/i, /google/i];

function humanlikeVoice(): SpeechSynthesisVoice | null {
  const english = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  for (const pattern of HUMANLIKE) {
    const match = english.find((voice) => pattern.test(voice.name) && voice.lang.toLowerCase() === "en-us") ?? english.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return english.find((voice) => voice.lang.toLowerCase() === "en-us") ?? english[0] ?? null;
}

export function speakAsMuse(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s[-–]\s/g, ", ").replace(/&/g, " and "));
  const voice = humanlikeVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
