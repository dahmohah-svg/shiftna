import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ShiftCard from "@/components/ShiftCard";
import { buttonClass, Checkbox, EmptyState, PageTitle, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { CITIES, SHIFT_TYPES, SUBSPECIALTIES } from "@/lib/constants";
import { SHIFT_WITH_HOSPITAL, SHIFT_WITH_HOSPITAL_INNER, type ShiftWithHospital } from "@/lib/shifts";
import type { Locale } from "@/i18n/routing";

function pick<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
}

export default async function ShiftsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/shifts">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const sp = await searchParams;
  const city = pick(CITIES, sp.city);
  const type = pick(SHIFT_TYPES, sp.type);
  const sub = pick(SUBSPECIALTIES, sp.sub);
  const paidOnDay = sp.paid === "1";
  const urgentOnly = sp.urgent === "1";
  const teamOnly = sp.team === "1";

  const t = await getTranslations("Shifts");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");

  const supabase = await createClient();
  // The feed shows public shifts plus shifts of the viewer's own teams
  // (admins may read every team's shifts, but should not see them here).
  const { data: myTeams } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", viewer.userId)
    .eq("status", "active");
  const teamIds = (myTeams ?? []).map((m) => m.group_id);

  let query = supabase
    .from("shifts")
    // Team shifts are only returned to that team's members (Row Level Security).
    .select(`${city ? SHIFT_WITH_HOSPITAL_INNER : SHIFT_WITH_HOSPITAL}, team:groups!shifts_group_id_fkey(name)`)
    .eq("status", "open")
    .gte("start_at", new Date().toISOString())
    .order("urgent", { ascending: false })
    .order("start_at", { ascending: true })
    .limit(60);
  if (city) query = query.eq("hospital.city", city);
  if (type) query = query.eq("type", type);
  if (sub) query = query.eq("subspecialty", sub);
  if (paidOnDay) query = query.eq("payment", "immediate");
  if (urgentOnly) query = query.eq("urgent", true);
  if (teamOnly) {
    query = teamIds.length ? query.in("group_id", teamIds) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  } else {
    query = teamIds.length
      ? query.or(`group_id.is.null,group_id.in.(${teamIds.join(",")})`)
      : query.is("group_id", null);
  }

  const { data } = await query;
  const shifts = (data ?? []) as unknown as (ShiftWithHospital & { team: { name: string } | null })[];
  const filtered = Boolean(city || type || sub || paidOnDay || urgentOnly || teamOnly);

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>

      <details className="mb-4 rounded-2xl border border-line bg-surface" open={filtered}>
        <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-brand-700">
          {t("filters")}
        </summary>
        <form className="flex flex-col gap-3 px-4 pb-4" method="get">
          <div className="grid grid-cols-2 gap-3">
            <Select name="city" defaultValue={city ?? ""} aria-label={t("city")}>
              <option value="">{t("city")}: {c("all")}</option>
              {CITIES.map((x) => (
                <option key={x} value={x}>{o(`city.${x}`)}</option>
              ))}
            </Select>
            <Select name="type" defaultValue={type ?? ""} aria-label={t("type")}>
              <option value="">{t("type")}: {c("all")}</option>
              {SHIFT_TYPES.map((x) => (
                <option key={x} value={x}>{o(`shiftType.${x}`)}</option>
              ))}
            </Select>
          </div>
          <Select name="sub" defaultValue={sub ?? ""} aria-label={t("subspecialty")}>
            <option value="">{t("subspecialty")}: {c("all")}</option>
            {SUBSPECIALTIES.map((x) => (
              <option key={x} value={x}>{o(`subspecialty.${x}`)}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Checkbox name="paid" value="1" defaultChecked={paidOnDay} label={t("paidOnDay")} />
            <Checkbox name="urgent" value="1" defaultChecked={urgentOnly} label={t("urgentOnly")} />
          </div>
          <Checkbox name="team" value="1" defaultChecked={teamOnly} label={t("teamShiftsOnly")} />
          <div className="grid grid-cols-2 gap-3">
            <button type="submit" className={buttonClass.primary}>{t("apply")}</button>
            <Link href="/shifts" className={buttonClass.secondary}>{t("clear")}</Link>
          </div>
        </form>
      </details>

      {shifts.length === 0 ? (
        <EmptyState
          action={<Link href="/post" className={buttonClass.secondary}>{t("emptyCta")}</Link>}
        >
          {t("empty")}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((s) => (
            <ShiftCard key={s.id} shift={s} mine={s.poster_id === viewer.userId} teamName={s.team?.name} />
          ))}
        </div>
      )}
    </>
  );
}
