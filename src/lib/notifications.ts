import type { Database } from "@/lib/supabase/database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/** Notification kinds the app knows how to show. Others are hidden. */
export const NOTIFICATION_KINDS = [
  "new_offer",
  "offer_accepted",
  "offer_refused",
  "instant_booked",
  "booking_cancelled",
  "new_message",
  "account_approved",
  "shift_alert",
  "urgent_shift",
  "shift_invite",
  "document_expiring",
  "team_approved",
  "team_rejected",
  "team_join_request",
  "team_joined",
  "team_shift",
  "hospital_added",
  "team_created",
  "team_verified",
  "team_paused",
  "team_resumed",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

type Payload = {
  shift_id?: string;
  booking_id?: string;
  hospital?: string;
  start_at?: string;
  doctor?: string;
  sender?: string;
  document?: string;
  expires_on?: string;
  team_id?: string;
  team?: string;
  reason?: string;
};

export function readPayload(n: NotificationRow): Payload {
  const p = n.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  const out: Payload = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") out[k as keyof Payload] = v;
  return out;
}

export function isKnownKind(kind: string): kind is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(kind);
}

/** Where tapping a notification takes the doctor. */
export function notificationHref(kind: NotificationKind, p: Payload): string {
  if (p.booking_id) return `/bookings/${p.booking_id}`;
  if (kind === "account_approved") return "/shifts";
  if (kind === "document_expiring") return "/profile";
  if (kind === "team_rejected") return "/teams";
  if (kind === "hospital_added") return "/admin?tab=hospitals";
  if (kind === "team_created") return "/admin?tab=teams";
  if (kind !== "team_shift" && p.team_id) return `/teams/${p.team_id}`;
  if (p.shift_id) return `/shifts/${p.shift_id}`;
  return "/activity";
}
