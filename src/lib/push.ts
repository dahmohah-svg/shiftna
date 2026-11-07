/** Public half of the Web Push (VAPID) key pair; the private half is the VAPID_PRIVATE_KEY setting on Vercel. */
export const VAPID_PUBLIC_KEY = "BASj9OujMZKLCKRGnPcK-xmUd25b8gJiopRRPVW5Z_AkId8S7ulm9ROix818OINebFrAmoNOGIDCMFDQs2e5yQ8";

/** The VAPID key as bytes, for pushManager.subscribe. */
export function vapidKeyBytes(): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
  const base64 = (VAPID_PUBLIC_KEY + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
