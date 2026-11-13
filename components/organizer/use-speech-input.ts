"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Browser speech to text (Web Speech API): Chrome and Safari have it, Firefox does
// not. The organizer talks, the transcript fills a text box they can still edit.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "The microphone is blocked for this site. Allow it in the browser, or type instead.",
  "service-not-allowed": "The microphone is blocked for this site. Allow it in the browser, or type instead.",
  "no-speech": "Didn't catch anything. Tap the mic and try again.",
  "audio-capture": "No microphone found. Type it instead.",
  network: "Speech needs a connection. Type it instead.",
};

const noSubscription = () => () => {};

export function useSpeechInput(onText: (text: string) => void) {
  // False during server rendering, the real answer once in the browser.
  const supported = useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const baseTextRef = useRef("");
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const start = useCallback((currentText: string) => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    setError(null);
    baseTextRef.current = currentText.trim();
    const recognition = new Constructor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let spoken = "";
      for (let index = 0; index < event.results.length; index += 1) spoken += event.results[index]?.[0].transcript ?? "";
      onTextRef.current([baseTextRef.current, spoken.trim()].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => setError(ERROR_MESSAGES[event.error] ?? "Speech stopped. Tap the mic to go on, or type.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Speech could not start. Type it instead.");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
