const brrrWebhookUrl = import.meta.env.VITE_BRRR_WEBHOOK_URL as string | undefined;
const lastSentHourKey = "brrr_last_sent_hour";
const reminderMessage = "Bebe Agua cojones";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function formatHourKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}`;
}

function isWithinWindow(now: Date, wakeHour: number, sleepHour: number): boolean {
  const hour = now.getHours();

  if (wakeHour === sleepHour) return true;
  if (wakeHour < sleepHour) return hour >= wakeHour && hour < sleepHour;

  return hour >= wakeHour || hour < sleepHour;
}

export function hasPushConfig(): boolean {
  return Boolean(brrrWebhookUrl);
}

export async function sendBrrrNotification(message: string): Promise<boolean> {
  if (!brrrWebhookUrl) return false;

  const response = await fetch(brrrWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: message
  });

  return response.ok;
}

export async function sendHourlyReminderIfNeeded(
  wakeHour: number,
  sleepHour: number,
  now: Date = new Date()
): Promise<boolean> {
  if (!hasPushConfig()) return false;
  if (!canUseStorage()) return false;
  if (!isWithinWindow(now, wakeHour, sleepHour)) return false;

  const hourKey = formatHourKey(now);
  if (window.localStorage.getItem(lastSentHourKey) === hourKey) return false;

  const sent = await sendBrrrNotification(reminderMessage);
  if (sent) window.localStorage.setItem(lastSentHourKey, hourKey);

  return sent;
}
