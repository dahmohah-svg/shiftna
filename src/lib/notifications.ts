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
  "job_offer",
  "job_offer_accepted",
  "job_offer_declined",
  "job_offer_withdrawn",
  "job_message",
  "team_supervisor",
  "rota_pending",
  "rota_published",
  "rota_returned",
  "rota_changed",
  "swap_request",
  "swap_declined",
  "swap_needs_approval",
  "swap_approved",
  "swap_rejected",
  "handover_new",
  "handover_received",
  "handover_comment",
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
  job_id?: string;
  title?: string;
  month?: string;
  date?: string;
  slot?: string;
  change?: string;
  handover_id?: string;
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
  if (p.job_id) return `/jobs/${p.job_id}`;
  if (p.team_id && kind.startsWith("handover_")) return `/teams/${p.team_id}/handover${p.handover_id ? `#h-${p.handover_id}` : ""}`;
  if (p.team_id && (kind.startsWith("rota_") || kind.startsWith("swap_"))) {
    const m = (p.month ?? p.date ?? "").slice(0, 7);
    return `/teams/${p.team_id}/rota${m ? `?month=${m}` : ""}`;
  }
  if (p.booking_id) return `/bookings/${p.booking_id}`;
  if (kind === "account_approved") return "/";
  if (kind === "document_expiring") return "/profile";
  if (kind === "team_rejected") return "/teams";
  if (kind === "hospital_added") return "/admin?tab=hospitals";
  if (kind === "team_created") return "/admin?tab=teams";
  if (kind !== "team_shift" && p.team_id) return `/teams/${p.team_id}`;
  if (p.shift_id) return `/shifts/${p.shift_id}`;
  return "/activity";
}
