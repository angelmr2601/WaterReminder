import OneSignal from "react-onesignal";

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const safariWebId = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID as string | undefined;

let initPromise: Promise<boolean> | null = null;

export function hasPushConfig() {
  return Boolean(appId);
}

export async function initPush() {
  if (!appId) return false;
  if (!initPromise) {
    const initOptions = {
      appId,
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
      allowLocalhostAsSecureOrigin: true,
      ...(safariWebId ? { safari_web_id: safariWebId } : {})
    };

    initPromise = OneSignal.init(initOptions)
      .then(() => true)
      .catch(() => false);
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
