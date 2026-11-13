"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createEndpointer } from "@/lib/audio/endpoint";
import { encodeWav, mergeChunks, resample, TRANSCRIBE_SAMPLE_RATE } from "@/lib/audio/wav";

// Tap to talk, tap again to stop (or it stops at MAX_SECONDS). With autoStop it
// also stops by itself when the student pauses after speaking. Records raw mic
// samples and hands back a 16 kHz mono WAV for Muse Voice Transcribe.

export const MAX_SECONDS = 30;

type Session = { stream: MediaStream; context: AudioContext; processor: ScriptProcessorNode; chunks: Float32Array[]; timer: number };

const noSubscription = () => () => {};
const canRecord = () =>
  typeof window !== "undefined" && typeof window.AudioContext === "function" && !!navigator.mediaDevices?.getUserMedia;

export function useVoiceRecorder(onClip: (wav: Blob) => void, onNoSpeech?: () => void) {
  const supported = useSyncExternalStore(noSubscription, canRecord, () => false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const startingRef = useRef(false);
  const onClipRef = useRef(onClip);
  const onNoSpeechRef = useRef(onNoSpeech);

  useEffect(() => {
    onClipRef.current = onClip;
    onNoSpeechRef.current = onNoSpeech;
  }, [onClip, onNoSpeech]);

  const finish = useCallback((send: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    window.clearTimeout(session.timer);
    session.processor.disconnect();
    session.stream.getTracks().forEach((track) => track.stop());
    const rate = session.context.sampleRate;
    void session.context.close();
    setRecording(false);
    if (!send) return;
    const samples = resample(mergeChunks(session.chunks), rate, TRANSCRIBE_SAMPLE_RATE);
    if (samples.length < TRANSCRIBE_SAMPLE_RATE / 4) {
      setError("Didn't catch that. Tap the mic and speak, then tap again.");
      return;
    }
    onClipRef.current(new Blob([encodeWav(samples, TRANSCRIBE_SAMPLE_RATE)], { type: "audio/wav" }));
  }, []);

  useEffect(() => () => finish(false), [finish]);

  const start = useCallback(async ({ autoStop = false }: { autoStop?: boolean } = {}) => {
    if (sessionRef.current || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      const endpoint = autoStop ? createEndpointer(context.sampleRate) : null;
      processor.onaudioprocess = (event) => {
        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        chunks.push(chunk);
        const state = endpoint?.(chunk);
        if (state === "done") finish(true);
        else if (state === "no-speech") {
          finish(false);
          onNoSpeechRef.current?.();
        }
      };
      source.connect(processor);
      processor.connect(context.destination);
      const timer = window.setTimeout(() => finish(true), MAX_SECONDS * 1000);
      sessionRef.current = { stream, context, processor, chunks, timer };
      setRecording(true);
    } catch {
      setError("The microphone is blocked or missing. Allow it in the browser, or type instead.");
    } finally {
      startingRef.current = false;
    }
  }, [finish]);

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(() => finish(false), [finish]);

  return { supported, recording, error, start, stop, cancel };
}
