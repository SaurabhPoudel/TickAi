import { useCallback, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useSharedValue } from "react-native-reanimated";

/**
 * Tap to talk. Streams a live transcript and a 0–1 loudness value for the mic animation.
 * onFinal fires once with the full sentence when the user stops talking.
 */
function speechAvailable() {
  try { return ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { return false; }
}

export function useVoice(onFinal: (text: string) => void) {
  // Firefox and some Android browsers have no speech recognition; the UI falls back to typing.
  const [available] = useState(speechAvailable);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const level = useSharedValue(0);
  const finalText = useRef("");

  useSpeechRecognitionEvent("start", () => { setListening(true); setError(null); });
  useSpeechRecognitionEvent("result", (e) => {
    const text = e.results[0]?.transcript ?? "";
    setTranscript(text);
    if (e.isFinal) finalText.current = text;
  });
  useSpeechRecognitionEvent("volumechange", (e) => {
    // Native values run roughly -2..10.
    level.value = Math.max(0, Math.min(1, (e.value + 2) / 12));
  });
  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    level.value = 0;
    const text = finalText.current.trim();
    finalText.current = "";
    if (text) onFinal(text);
  });
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    if (e.error === "no-speech" || e.error === "aborted") return;
    setError(e.error === "not-allowed"
      ? "Tuck needs microphone access. Turn it on in Settings, or type instead."
      : "Didn't catch that. Tap the mic and try again.");
  });

  const start = useCallback(async () => {
    if (!available) { setError("Voice isn't supported in this browser. Type instead, or try Chrome or Safari."); return; }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError("Tuck needs microphone access. Turn it on in Settings, or type instead.");
      return;
    }
    setTranscript("");
    finalText.current = "";
    ExpoSpeechRecognitionModule.start({
      lang: "en-US", interimResults: true, continuous: false, addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
  }, [available]);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { available, listening, transcript, error, level, start, stop, toggle, setTranscript };
}
