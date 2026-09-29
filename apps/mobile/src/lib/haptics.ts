import { Platform } from "react-native";
import * as H from "expo-haptics";

/** Haptics on phones, silently nothing on the web. */
const on = Platform.OS !== "web";
export const ImpactFeedbackStyle = H.ImpactFeedbackStyle;
export const NotificationFeedbackType = H.NotificationFeedbackType;
export const selectionAsync = () => (on ? H.selectionAsync().catch(() => {}) : Promise.resolve());
export const impactAsync = (s: H.ImpactFeedbackStyle) => (on ? H.impactAsync(s).catch(() => {}) : Promise.resolve());
export const notificationAsync = (t: H.NotificationFeedbackType) => (on ? H.notificationAsync(t).catch(() => {}) : Promise.resolve());
