import webpush from "web-push";
import { createTranslator } from "next-intl";
import { createClient } from "@supabase/supabase-js";
import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import { isKnownKind, notificationHref, readPayload, type NotificationRow } from "@/lib/notifications";
import { notificationValues } from "@/lib/notification-text";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

// Called by the database (migration 026) for each new notification of a
// user with phone notifications on. It proves itself with a shared secret.

type Sub = { endpoint: string; p256dh: string; auth: string; locale: string };
type Body = { id: string; kind: string; payload: NotificationRow["payload"]; subscriptions: Sub[] };

const MESSAGES = { ar, en } as const;

function render(kind: string, payload: NotificationRow["payload"], locale: "ar" | "en") {
  const messages = MESSAGES[locale];
  const t = createTranslator({ locale, messages, namespace: "Notifications" });
  const o = createTranslator({ locale, messages, namespace: "Options" });
  const d = createTranslator({ locale, messages, namespace: "Docs" });
  const c = createTranslator({ locale, messages, namespace: "Common" });
  const p = readPayload({ payload } as NotificationRow);
  if (!isKnownKind(kind)) return null;
  const body = t(
    `kinds.${kind}`,
    notificationValues(p, locale, {
      option: (k) => o(k as "rotaSlot.day"),
      doc: (k) => d(k as "license"),
      dash: c("dash"),
    }),
  );
  return {
    title: c("appName"),
    body,
    url: `/${locale}${notificationHref(kind, p)}`,
    dir: locale === "ar" ? "rtl" : "ltr",
    lang: locale,
  };
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !privateKey) return new Response("Push is not set up", { status: 503 });
  if (request.headers.get("x-push-secret") !== secret) return new Response("Forbidden", { status: 403 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!Array.isArray(body.subscriptions) || body.subscriptions.length === 0) return Response.json({ sent: 0 });

  webpush.setVapidDetails("mailto:support@shiftna.app", VAPID_PUBLIC_KEY, privateKey);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    body.subscriptions.slice(0, 20).map(async (s) => {
      const message = render(body.kind, body.payload, s.locale === "en" ? "en" : "ar");
      if (!message) return;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...message, tag: `${body.kind}-${body.id}` }),
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the phone turned notifications off or the app was removed.
        if (status === 404 || status === 410) gone.push(s.endpoint);
      }
    }),
  );

  if (gone.length) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    await supabase.rpc("remove_push_subscriptions", { p_secret: secret, p_endpoints: gone });
  }
  return Response.json({ sent, removed: gone.length });
}
