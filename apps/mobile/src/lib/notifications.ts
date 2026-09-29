import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const BEDTIME_ID = "tuck-bedtime";
const isWeb = Platform.OS === "web";

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
}

export async function askPermission() {
  if (isWeb) {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    return (await Notification.requestPermission()) === "granted";
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/* ---------- Web: browsers can't schedule while closed, so remind while Tuck is open in a tab ---------- */
let webTimer: ReturnType<typeof setTimeout> | null = null;
let onWebOpen: ((url: string) => void) | null = null;
export function setWebNotificationHandler(fn: (url: string) => void) { onWebOpen = fn; }

function scheduleWeb(bedtime: string, title: string, body: string) {
  if (webTimer) clearTimeout(webTimer);
  const [h, m] = bedtime.split(":").map(Number);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  webTimer = setTimeout(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body, tag: BEDTIME_ID });
      n.onclick = () => { window.focus(); onWebOpen?.("/checkin"); n.close(); };
    }
    scheduleWeb(bedtime, title, body);
  }, next.getTime() - Date.now());
}

/** One gentle nudge a day, at the user's bedtime. Never more. */
export async function scheduleBedtime(bedtime: string, name?: string | null) {
  const granted = await askPermission();
  if (!granted) return false;
  const title = name ? `Time to tuck in, ${name}` : "Time to tuck in";
  const body = "A minute to close out today and see tomorrow.";
  if (isWeb) { scheduleWeb(bedtime, title, body); return true; }

  await Notifications.cancelScheduledNotificationAsync(BEDTIME_ID).catch(() => {});
  const [hour, minute] = bedtime.split(":").map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: BEDTIME_ID,
    content: { title, body, data: { url: "/checkin" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  return true;
}

/** Re-arm the web reminder each time the app opens (timers don't survive a reload). */
export function restoreWebReminder(bedtime: string, name?: string | null) {
  if (!isWeb || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  scheduleWeb(bedtime, name ? `Time to tuck in, ${name}` : "Time to tuck in", "A minute to close out today and see tomorrow.");
}

/** Taps on native notifications. Returns an unsubscribe function. */
export function listenForOpens(open: (url: string) => void) {
  if (isWeb) { setWebNotificationHandler(open); return () => setWebNotificationHandler(() => {}); }
  const handle = (n: Notifications.Notification) => {
    const url = n.request.content.data?.url;
    if (typeof url === "string") open(url);
  };
  const last = Notifications.getLastNotificationResponse();
  if (last) handle(last.notification);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handle(r.notification));
  return () => sub.remove();
}
