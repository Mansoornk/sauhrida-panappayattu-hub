import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deletePushSubscription, getPushPublicKey, savePushSubscription } from "./payatt.functions";

const SW_URL = "/push-sw.js";
const STATUS_KEY = ["draw-alerts-status"] as const;

export type AlertSupport = "supported" | "unsupported" | "ios-install";

export function alertSupport(): AlertSupport {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return ios && !standalone ? "ios-install" : "unsupported";
  if (ios && !standalone) return "ios-install";
  return "supported";
}

function keyBytes(b64: string): Uint8Array {
  const pad = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (alertSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg || !reg.active?.scriptURL.endsWith(SW_URL)) return null;
  return reg.pushManager.getSubscription();
}

async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  if (reg.active) return reg;
  const sw = reg.installing ?? reg.waiting;
  await new Promise<void>((resolve) => {
    if (!sw) return resolve();
    sw.addEventListener("statechange", () => sw.state === "activated" && resolve());
    setTimeout(resolve, 8000);
  });
  return reg;
}

/** Phone alerts for the live draw: whether they're on on this device, and switches to change that. */
export function useDrawAlerts(viewerToken: string | null) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => ({ support: alertSupport(), on: !!(await currentSubscription()) }),
    staleTime: Infinity,
  });

  const enable = useCallback(async () => {
    if (!viewerToken) throw new Error("Please sign in first");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notifications are blocked. Allow them for this app in your phone's settings.");
    const [{ publicKey }, reg] = await Promise.all([getPushPublicKey(), activeRegistration()]);
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
    const json = sub.toJSON();
    await savePushSubscription({
      data: {
        token: viewerToken,
        subscription: { endpoint: sub.endpoint, keys: { p256dh: json.keys?.["p256dh"] ?? "", auth: json.keys?.["auth"] ?? "" } },
      },
    });
    await qc.invalidateQueries({ queryKey: STATUS_KEY });
  }, [viewerToken, qc]);

  const disable = useCallback(async () => {
    const sub = await currentSubscription();
    if (sub) {
      if (viewerToken) await deletePushSubscription({ data: { token: viewerToken, endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    await qc.invalidateQueries({ queryKey: STATUS_KEY });
  }, [viewerToken, qc]);

  return { support: status.data?.support ?? "unsupported", on: status.data?.on ?? false, loading: status.isPending, enable, disable };
}
