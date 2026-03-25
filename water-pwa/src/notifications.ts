const brrrWebhookUrl = import.meta.env.VITE_BRRR_WEBHOOK_URL as string | undefined;

const lastSentHourKey = "brrr_last_sent_hour";
const brrrEnabledKey = "brrr_push_enabled";
const reminderMessage = "Bebe Agua cojones";

type PushAvailability = "ready" | "unconfigured";
type PushProvider = "brrr" | "none";

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function canUseStorage(): boolean {
  if (!canUseWindow()) return false;

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function formatHourKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");

  return `${y}-${m}-${d}-${h}`;
}

function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) return 0;
  return ((Math.floor(hour) % 24) + 24) % 24;
}

function isWithinWindow(now: Date, wakeHour: number, sleepHour: number): boolean {
  const hour = now.getHours();
  const wake = normalizeHour(wakeHour);
  const sleep = normalizeHour(sleepHour);

  if (wake === sleep) return true;
  if (wake < sleep) return hour >= wake && hour < sleep;

  return hour >= wake || hour < sleep;
}

function isBrrrEnabled(): boolean {
  if (!canUseStorage()) return true;

  try {
    return window.localStorage.getItem(brrrEnabledKey) !== "false";
  } catch {
    return true;
  }
}

function setBrrrEnabled(enabled: boolean): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(brrrEnabledKey, enabled ? "true" : "false");
  } catch {
    // ignorar error de storage
  }
}

export function getPushProvider(): PushProvider {
  return brrrWebhookUrl ? "brrr" : "none";
}

export function hasPushConfig(): boolean {
  return Boolean(brrrWebhookUrl);
}

export function getPushAvailability(): PushAvailability {
  return hasPushConfig() ? "ready" : "unconfigured";
}

export async function initPush(): Promise<boolean> {
  return hasPushConfig();
}

export async function sendBrrrNotification(message: string): Promise<boolean> {
  if (!brrrWebhookUrl) return false;
  if (!isBrrrEnabled()) return false;

  try {
    const response = await fetch(brrrWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      },
      body: message
    });

    return response.ok;
  } catch (error) {
    console.error("Error enviando BRRR notification:", error);
    return false;
  }
}

export async function sendBrrrTestNotification(
  message = reminderMessage
): Promise<boolean> {
  return sendBrrrNotification(message);
}

export async function getPushStatus(): Promise<{
  provider: PushProvider;
  configured: boolean;
  available: boolean;
  subscribed: boolean;
  permission: "granted" | "default";
  blockedByClient: boolean;
}> {
  const configured = hasPushConfig();

  if (!configured) {
    return {
      provider: "none",
      configured: false,
      available: false,
      subscribed: false,
      permission: "default",
      blockedByClient: false
    };
  }

  return {
    provider: "brrr",
    configured: true,
    available: true,
    subscribed: isBrrrEnabled(),
    permission: "granted",
    blockedByClient: false
  };
}

export async function subscribeToPush(): Promise<boolean> {
  if (!hasPushConfig()) return false;

  setBrrrEnabled(true);
  return true;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!hasPushConfig()) return false;

  setBrrrEnabled(false);
  return true;
}

export async function sendHourlyReminderIfNeeded(
  wakeHour: number,
  sleepHour: number,
  now: Date = new Date()
): Promise<boolean> {
  if (!hasPushConfig()) return false;
  if (!canUseStorage()) return false;
  if (!isBrrrEnabled()) return false;
  if (!isWithinWindow(now, wakeHour, sleepHour)) return false;

  const hourKey = formatHourKey(now);

  try {
    if (window.localStorage.getItem(lastSentHourKey) === hourKey) {
      return false;
    }

    const sent = await sendBrrrNotification(reminderMessage);

    if (sent) {
      window.localStorage.setItem(lastSentHourKey, hourKey);
    }

    return sent;
  } catch (error) {
    console.error("Error enviando recordatorio horario:", error);
    return false;
  }
}