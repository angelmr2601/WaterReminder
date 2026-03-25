const brrrWebhookUrl = import.meta.env.VITE_BRRR_WEBHOOK_URL as string | undefined;
const lastSentHourKey = "brrr_last_sent_hour";

function formatHourKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}`;
}

function isWithinWindow(now: Date, wakeHour: number, sleepHour: number) {
  const hour = now.getHours();

  if (wakeHour === sleepHour) return true;

  if (wakeHour < sleepHour) {
    return hour >= wakeHour && hour < sleepHour;
  }

  return hour >= wakeHour || hour < sleepHour;
}

export function hasPushConfig() {
  return Boolean(brrrWebhookUrl);
}

export async function sendBrrrNotification(message: string) {
  if (!brrrWebhookUrl) return false;

  const response = await fetch(brrrWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    },
    body: message
  });

  return response.ok;
}

export async function sendHourlyReminderIfNeeded(wakeHour: number, sleepHour: number, now = new Date()) {
  if (!hasPushConfig()) return false;
  if (!isWithinWindow(now, wakeHour, sleepHour)) return false;

  const hourKey = formatHourKey(now);
  const alreadySent = window.localStorage.getItem(lastSentHourKey) === hourKey;
  if (alreadySent) return false;

  const ok = await sendBrrrNotification("Bebe Agua cojones");
  if (ok) {
    window.localStorage.setItem(lastSentHourKey, hourKey);
  }

  return ok;
}
