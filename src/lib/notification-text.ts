import { DOC_TYPES, ROTA_SLOTS } from "@/lib/constants";
import type { readPayload } from "@/lib/notifications";
import { monthLabel } from "@/lib/rota";
import { formatDate, formatDateTime, formatNumber } from "@/lib/time";

type Payload = ReturnType<typeof readPayload>;
type Lookup = (key: string) => string;

/**
 * The values a notification sentence needs ({hospital}, {when}, {slot}…),
 * formatted for the language. Shared by the alerts page and phone pushes.
 */
export function notificationValues(
  p: Payload,
  locale: string,
  tr: { option: Lookup; doc: Lookup; dash: string },
): Record<string, string> {
  const { dash } = tr;
  return {
    hospital: p.hospital ?? dash,
    when: p.start_at ? formatDateTime(p.start_at, locale) : dash,
    doctor: p.doctor ?? dash,
    sender: p.sender ?? dash,
    document: p.document && (DOC_TYPES as readonly string[]).includes(p.document) ? tr.doc(p.document) : dash,
    date: p.expires_on ? formatDate(p.expires_on, locale) : p.date ? formatDate(p.date, locale) : dash,
    month: p.month ? monthLabel(p.month.slice(0, 7), locale) : dash,
    slot: p.slot && (ROTA_SLOTS as readonly string[]).includes(p.slot) ? tr.option(`rotaSlot.${p.slot}`) : dash,
    team: p.team ?? dash,
    reason: p.reason ?? dash,
    title: p.title ?? dash,
    count: p.count ? formatNumber(Number(p.count), locale) : dash,
  };
}
