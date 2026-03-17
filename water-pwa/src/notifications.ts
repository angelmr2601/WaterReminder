import OneSignal from "react-onesignal";

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const safariWebId = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID as string | undefined;

let initPromise: Promise<boolean> | null = null;
let lastPushError: string | null = null;

function normalizeError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const upper = msg.toUpperCase();

  if (upper.includes("ERR_BLOCKED_BY_CLIENT") || upper.includes("BLOCKED_BY_CLIENT")) {
    return "Bloqueado por un adblock/anti-tracker del navegador (ERR_BLOCKED_BY_CLIENT).";
  }

  return msg;
}

function storeError(error: unknown) {
  lastPushError = normalizeError(error);
}

function clearError() {
  lastPushError = null;
}

export function hasPushConfig() {
  return Boolean(appId);
}

export function getLastPushError() {
  return lastPushError;
}

export async function initPush() {
  if (!appId) return false;
  if (!initPromise) {
    const initOptions = {
      appId,
      serviceWorkerPath: "/onesignal/OneSignalSDKWorker.js",
      serviceWorkerUpdaterPath: "/onesignal/OneSignalSDKUpdaterWorker.js",
      allowLocalhostAsSecureOrigin: true,
      ...(safariWebId ? { safari_web_id: safariWebId } : {})
    };

    initPromise = OneSignal.init(initOptions)
      .then(() => {
        clearError();
        return true;
      })
      .catch((error) => {
        storeError(error);
        return false;
      });
  }

  return initPromise;
}

export async function getPushStatus() {
  const ready = await initPush();
  if (!ready) {
    return { configured: false, subscribed: false, permission: "default" as NotificationPermission };
  }

  const subscribed = OneSignal.User.PushSubscription.optedIn ?? false;

  return {
    configured: true,
    subscribed,
    permission: Notification.permission
  };
}

export async function subscribeToPush() {
  const ready = await initPush();
  if (!ready) return false;

  try {
    await OneSignal.Notifications.requestPermission();
    await OneSignal.User.PushSubscription.optIn();
    clearError();
    return OneSignal.User.PushSubscription.optedIn ?? false;
  } catch (error) {
    storeError(error);
    return false;
  }
}

export async function unsubscribeFromPush() {
  const ready = await initPush();
  if (!ready) return false;

  try {
    await OneSignal.User.PushSubscription.optOut();
    clearError();
    return OneSignal.User.PushSubscription.optedIn ?? false;
  } catch (error) {
    storeError(error);
    return false;
  }
}
