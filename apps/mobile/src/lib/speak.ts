import * as Speech from "expo-speech";

/** Hushtick's voice: a touch slower and lower than default, because it's bedtime. */
export function speak(text: string, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, { rate: 0.94, pitch: 0.96, onDone, onStopped: onDone, onError: () => onDone?.() });
}

export const stopSpeaking = () => Speech.stop();
