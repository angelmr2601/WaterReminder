const brrrWebhookUrl = import.meta.env.VITE_BRRR_WEBHOOK_URL as string | undefined;
const lastSentHourKey = "brrr_last_sent_hour";

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const safariWebId = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID as string | undefined;
const brrrWebhookUrl = import.meta.env.VITE_BRRR_WEBHOOK_URL as string | undefined;

type PushAvailability = "ready" | "unsupported" | "blocked" | "unconfigured";
type PushProvider = "onesignal" | "brrr" | "none";
const brrrEnabledKey = "brrr_push_enabled";

  if (wakeHour === sleepHour) return true;

  if (wakeHour < sleepHour) {
    return hour >= wakeHour && hour < sleepHour;
  }

  return hour >= wakeHour || hour < sleepHour;
}

export function hasPushConfig() {
  return Boolean(appId || brrrWebhookUrl);
}

export function getPushProvider(): PushProvider {
  if (brrrWebhookUrl) return "brrr";
  if (appId) return "onesignal";
  return "none";
}

function isBrrrEnabled() {
  if (typeof window === "undefined") return true;
  const value = window.localStorage.getItem(brrrEnabledKey);
  return value !== "false";
}

function setBrrrEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(brrrEnabledKey, enabled ? "true" : "false");
}

export function getPushAvailability(): PushAvailability {
  if (!hasPushConfig()) return "unconfigured";
  if (getPushProvider() === "brrr") return "ready";
  if (!isNotificationApiAvailable()) return "unsupported";
  return "ready";
}

export async function initPush() {
  if (getPushAvailability() !== "ready") return false;
  if (getPushProvider() === "brrr") return true;

  if (!initPromise) {
    const initOptions = {
      appId: appId!,
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
      allowLocalhostAsSecureOrigin: true,
      ...(safariWebId ? { safari_web_id: safariWebId } : {})
    };

  const response = await fetch(brrrWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    },
    body: message
  });

  return response.ok;
}

export async function getPushStatus() {
  const availability = getPushAvailability();
  const provider = getPushProvider();

  if (availability !== "ready") {
    return {
      provider,
      configured: availability !== "unconfigured",
      available: false,
      subscribed: false,
      permission: "default" as NotificationPermission,
      blockedByClient: false
    };
  }

  if (provider === "brrr") {
    return {
      provider,
      configured: true,
      available: true,
      subscribed: isBrrrEnabled(),
      permission: "granted" as NotificationPermission,
      blockedByClient: false
    };
  }

  const ready = await initPush();
  if (!ready) {
    return {
      provider,
      configured: true,
      available: false,
      subscribed: false,
      permission: Notification.permission,
      blockedByClient: true
    };
  }

  const subscribed = OneSignal.User.PushSubscription.optedIn ?? false;

  return {
    provider,
    configured: true,
    available: true,
    subscribed,
    permission: Notification.permission,
    blockedByClient: false
  };
}

export async function subscribeToPush() {
  if (getPushProvider() === "brrr") {
    setBrrrEnabled(true);
    return true;
  }

  const ready = await initPush();
  if (!ready) return false;

  await OneSignal.Notifications.requestPermission();
  await OneSignal.User.PushSubscription.optIn();
  return OneSignal.User.PushSubscription.optedIn ?? false;
}

export async function unsubscribeFromPush() {
  if (getPushProvider() === "brrr") {
    setBrrrEnabled(false);
    return false;
  }

  const ready = await initPush();
  if (!ready) return false;

  await OneSignal.User.PushSubscription.optOut();
  return OneSignal.User.PushSubscription.optedIn ?? false;
}

export async function sendBrrrTestNotification(message = "Bebe Agua cojones") {
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
