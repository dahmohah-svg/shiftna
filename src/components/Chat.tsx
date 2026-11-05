"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { subscribeAsUser } from "@/lib/supabase/realtime";
import { buttonClass, inputClass, Notice } from "./ui";

type Message = { id: string; sender_id: string; body: string; created_at: string };

/**
 * Chat for a booking, or for a hospital's job offer. Messages arrive live
 * through Supabase Realtime; Row Level Security means only the two people
 * in that booking or job offer can read or send.
 */
export default function Chat({
  bookingId,
  jobOfferId,
  me,
  initial,
  disabled,
}: {
  bookingId?: string;
  jobOfferId?: string;
  me: string;
  initial: Message[];
  disabled?: boolean;
}) {
  const thread = jobOfferId
    ? ({ table: "job_messages", column: "job_offer_id", id: jobOfferId } as const)
    : ({ table: "messages", column: "booking_id", id: bookingId! } as const);
  const t = useTranslations("Booking");
  const e = useTranslations("Errors");
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeAsUser(createClient(), (supabase) =>
      supabase.channel(`${thread.table}-${thread.id}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: thread.table, filter: `${thread.column}=eq.${thread.id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      ),
    );
  }, [thread.table, thread.column, thread.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    const body = text.trim();
    if (!body || body.length > 2000) return;
    setSending(true);
    setError(false);
    const supabase = createClient();
    const { data, error: err } =
      thread.table === "job_messages"
        ? await supabase
            .from("job_messages")
            .insert({ job_offer_id: thread.id, sender_id: me, body })
            .select("id, sender_id, body, created_at")
            .single()
        : await supabase
            .from("messages")
            .insert({ booking_id: thread.id, sender_id: me, body })
            .select("id, sender_id, body, created_at")
            .single();
    setSending(false);
    if (err || !data) {
      setError(true);
      return;
    }
    setText("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
      timeZone: "Africa/Cairo",
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-80 min-h-24 flex-col gap-2 overflow-y-auto rounded-xl bg-page p-3">
        {messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-ink-muted">{t("noMessages")}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "self-end bg-brand-600 text-white" : "self-start bg-surface text-ink border border-line"}`}
              >
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={`pt-0.5 text-[10px] ${mine ? "text-white/70" : "text-ink-muted"}`}>{time(m.created_at)}</p>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      {error ? <Notice tone="danger">{e("generic")}</Notice> : null}
      {!disabled ? (
        <form onSubmit={send} className="flex gap-2">
          <input
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            maxLength={2000}
            placeholder={t("chatPlaceholder")}
            aria-label={t("chatPlaceholder")}
            className={inputClass}
          />
          <button type="submit" disabled={sending || !text.trim()} className={buttonClass.primary}>
            {t("send")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
