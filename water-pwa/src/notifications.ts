import OneSignal from "react-onesignal";

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const safariWebId = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID as string | undefined;

type PushAvailability = "ready" | "unsupported" | "blocked" | "unconfigured";

let initPromise: Promise<boolean> | null = null;

function isNotificationApiAvailable() {
  return typeof window !== "undefined" && "Notification" in window;
}

function isBlockedByClientError(error: unknown) {
  if (!error) return false;
  const message = String(error);
  return message.includes("ERR_BLOCKED_BY_CLIENT");
}

export function hasPushConfig() {
  return Boolean(appId);
}

export function getPushAvailability(): PushAvailability {
  if (!hasPushConfig()) return "unconfigured";
  if (!isNotificationApiAvailable()) return "unsupported";
  return "ready";
}

export async function initPush() {
  if (getPushAvailability() !== "ready") return false;

  if (!initPromise) {
    const initOptions = {
      appId: appId!,
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
      allowLocalhostAsSecureOrigin: true,
      ...(safariWebId ? { safari_web_id: safariWebId } : {})
    };

    initPromise = OneSignal.init(initOptions)
      .then(() => true)
      .catch((error) => {
        if (isBlockedByClientError(error)) {
          return false;
        }
        console.error("No se pudo inicializar OneSignal", error);
        return false;
      });
  }

  return initPromise;
}

export async function getPushStatus() {
  const availability = getPushAvailability();

  if (availability !== "ready") {
    return {
      configured: availability !== "unconfigured",
      available: false,
      subscribed: false,
      permission: "default" as NotificationPermission,
      blockedByClient: false
    };
  }

  const ready = await initPush();
  if (!ready) {
    return {
      configured: true,
      available: false,
      subscribed: false,
      permission: Notification.permission,
      blockedByClient: true
    };
  }

  const subscribed = OneSignal.User.PushSubscription.optedIn ?? false;

  return {
    configured: true,
    available: true,
    subscribed,
    permission: Notification.permission,
    blockedByClient: false
  };
}

export async function subscribeToPush() {
  const ready = await initPush();
  if (!ready) return false;

  await OneSignal.Notifications.requestPermission();
  await OneSignal.User.PushSubscription.optIn();
  return OneSignal.User.PushSubscription.optedIn ?? false;
}

export async function unsubscribeFromPush() {
  const ready = await initPush();
  if (!ready) return false;

  await OneSignal.User.PushSubscription.optOut();
  return OneSignal.User.PushSubscription.optedIn ?? false;
}
