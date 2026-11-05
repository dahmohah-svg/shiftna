import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import { AddHospitalForm, ApproveDoctorForm, RejectDoctorForm } from "@/components/AdminForms";
import { RejectTeamForm } from "@/components/TeamForms";
import HospitalTrustBadge from "@/components/HospitalTrustBadge";
import { getHospitalTrust } from "@/lib/hospitals";
import { Badge, Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { decideReport, setHospitalVerified, setPremium, suspendDoctor } from "@/app/actions/admin";
import { reviewTeam } from "@/app/actions/teams";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/viewer";
import { REQUIRED_DOCS } from "@/lib/constants";
import { cairoToday, formatDate, formatDateTime } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

const TABS = ["doctors", "teams", "hospitals", "reports", "members"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireAdmin(locale);
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "doctors";
  const t = await getTranslations("Admin");
  const o = await getTranslations("Options");
  const d = await getTranslations("Docs");
  const ob = await getTranslations("Onboarding");
  const p = await getTranslations("Profile");
  const tm = await getTranslations("Teams");
  const supabase = await createClient();

  const tabLabel: Record<Tab, string> = {
    doctors: t("tabDoctors"),
    hospitals: t("tabHospitals"),
    reports: t("tabReports"),
    members: t("tabMembers"),
    teams: tm("tab"),
  };

  let content: React.ReactNode = null;

  if (tab === "doctors") {
    const { data: pending } = await supabase
      .from("profiles")
      .select("id, full_name, grade, city, phone, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    const ids = (pending ?? []).map((p) => p.id);
    const { data: docs } = ids.length
      ? await supabase
          .from("documents")
          .select("id, user_id, type, status, file_path, reject_reason, created_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] };

    // Latest document of each type, with a short-lived private link.
    const byUser = new Map<string, Map<string, NonNullable<typeof docs>[number] & { url?: string }>>();
    for (const doc of docs ?? []) {
      const m = byUser.get(doc.user_id) ?? new Map();
      if (!m.has(doc.type)) m.set(doc.type, { ...doc });
      byUser.set(doc.user_id, m);
    }
    const all = [...byUser.values()].flatMap((m) => [...m.values()]);
    if (all.length) {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrls(all.map((x) => x.file_path), 300);
      signed?.forEach((s, i) => {
        if (s.signedUrl) all[i].url = s.signedUrl;
      });
    }

    content = (
      <section className="flex flex-col gap-3">
        <SectionTitle>{t("pendingDoctors")}</SectionTitle>
        <Notice tone="warn">{t("linkNote")}</Notice>
        {(pending ?? []).length === 0 ? <EmptyState>{t("noPending")}</EmptyState> : null}
        {(pending ?? []).map((p) => {
          const m = byUser.get(p.id);
          const complete = REQUIRED_DOCS.every((k) => m?.get(k) && m.get(k)!.status !== "rejected");
          return (
            <Card key={p.id} className="flex flex-col gap-3">
              <div className="flex flex-col">
                <span className="text-lg font-bold">{p.full_name || "—"}</span>
                <span className="text-sm text-ink-muted">
                  {p.grade ? o(`grade.${p.grade as "resident"}`) : "—"} · {p.city ? o(`city.${p.city as "cairo"}`) : "—"}
                  {p.phone ? <> · <span dir="ltr">{p.phone}</span></> : null}
                </span>
                <span className="text-xs text-ink-muted">{formatDateTime(p.created_at, locale)}</span>
              </div>
              {!m ? (
                <p className="text-sm text-ink-muted">{t("noDocs")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {REQUIRED_DOCS.map((k) => {
                    const doc = m.get(k);
                    return (
                      <li key={k} className="flex items-center justify-between gap-2 rounded-xl bg-page px-3 py-2 text-sm">
                        <span className="font-semibold">{d(k)}</span>
                        <span className="flex items-center gap-2">
                          {doc ? (
                            <Badge tone={doc.status === "rejected" ? "danger" : doc.status === "approved" ? "success" : "brand"}>
                              {doc.status === "rejected" ? ob("rejected", { reason: doc.reject_reason ?? "" }) : doc.status === "approved" ? ob("approved") : ob("uploaded")}
                            </Badge>
                          ) : (
                            <Badge>{ob("notUploaded")}</Badge>
                          )}
                          {doc?.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
                              {t("open")}
                            </a>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-ink-muted">{t("checklist")}</p>
              {complete ? <ApproveDoctorForm userId={p.id} minDate={cairoToday()} /> : null}
              {m ? (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("reject")}</summary>
                  <div className="pt-3">
                    <RejectDoctorForm userId={p.id} />
                  </div>
                </details>
              ) : null}
            </Card>
          );
        })}
      </section>
    );
  }

  if (tab === "hospitals") {
    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("*, adder:profiles!hospitals_added_by_fkey(id, full_name)")
      .order("verified", { ascending: true })
      .order("created_at", { ascending: false });
    const trust = await getHospitalTrust(supabase, (hospitals ?? []).map((h) => h.id));
    const ht = await getTranslations("Hospitals");
    content = (
      <section className="flex flex-col gap-4">
        <Card>
          <SectionTitle>{t("addHospital")}</SectionTitle>
          <AddHospitalForm />
        </Card>
        <SectionTitle>{t("hospitalsList")}</SectionTitle>
        {(hospitals ?? []).length === 0 ? <EmptyState>{t("noHospitals")}</EmptyState> : null}
        {(hospitals ?? []).map((h) => (
          <Card key={h.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-bold">{h.name}</span>
                <span className="text-sm text-ink-muted">
                  {o(`city.${h.city as "cairo"}`)}
                  {h.area ? ` · ${h.area}` : ""}
                </span>
                {h.contact ? <span className="text-xs text-ink-muted" dir="ltr">{h.contact}</span> : null}
                {h.adder ? (
                  <Link href={`/doctors/${h.adder.id}`} className="text-xs text-brand-700 underline">
                    {ht("addedBy", { name: h.adder.full_name ?? "—" })}
                  </Link>
                ) : null}
                {trust.get(h.id) ? (
                  <span className="text-xs text-ink-muted">
                    {ht("activity", {
                      shifts: trust.get(h.id)!.shiftsPosted,
                      posters: trust.get(h.id)!.posters,
                      completed: trust.get(h.id)!.completed,
                    })}
                  </span>
                ) : null}
              </div>
              <HospitalTrustBadge level={trust.get(h.id)?.level ?? (h.verified ? "verified" : "new")} />
            </div>
            <ActionButton
              action={setHospitalVerified}
              fields={{ id: h.id, verified: h.verified ? "0" : "1" }}
              variant={h.verified ? "secondary" : "primary"}
            >
              {h.verified ? t("unverify") : t("verify")}
            </ActionButton>
          </Card>
        ))}
      </section>
    );
  }

  if (tab === "teams") {
    const { data: teams } = await supabase
      .from("groups")
      .select(
        "id, name, institution, description, proof_path, created_at, creator:profiles!groups_created_by_fkey(id, full_name, grade), hospital:hospitals!groups_hospital_id_fkey(name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const withProof = (teams ?? []).filter((g) => g.proof_path);
    const proofUrl = new Map<string, string>();
    if (withProof.length) {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrls(withProof.map((g) => g.proof_path!), 300);
      signed?.forEach((u, i) => {
        if (u.signedUrl) proofUrl.set(withProof[i].id, u.signedUrl);
      });
    }
    content = (
      <section className="flex flex-col gap-3">
        <SectionTitle>{tm("pendingTeams")}</SectionTitle>
        <Notice tone="warn">{t("linkNote")}</Notice>
        {(teams ?? []).length === 0 ? <EmptyState>{tm("noPendingTeams")}</EmptyState> : null}
        {(teams ?? []).map((g) => (
          <Card key={g.id} className="flex flex-col gap-2">
            <span className="text-lg font-bold">{g.name}</span>
            <span className="text-sm text-ink-muted">
              {g.institution}
              {g.hospital ? ` · ${g.hospital.name}` : null}
            </span>
            {g.description ? <p className="whitespace-pre-line text-sm">{g.description}</p> : null}
            <span className="text-xs text-ink-muted">
              {tm("createdBy")}{" "}
              {g.creator ? (
                <Link href={`/doctors/${g.creator.id}`} className="font-semibold text-brand-700 underline">
                  {g.creator.full_name}
                </Link>
              ) : (
                "—"
              )}{" "}
              · {formatDateTime(g.created_at, locale)}
            </span>
            {proofUrl.get(g.id) ? (
              <a href={proofUrl.get(g.id)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-700 underline">
                {tm("openProof")}
              </a>
            ) : (
              <Notice tone="warn">{tm("noProof")}</Notice>
            )}
            <p className="text-xs text-ink-muted">{tm("reviewChecklist")}</p>
            <ActionButton action={reviewTeam} fields={{ teamId: g.id, approve: "1" }}>
              {tm("approve")}
            </ActionButton>
            <RejectTeamForm teamId={g.id} />
          </Card>
        ))}
      </section>
    );
  }

  if (tab === "reports") {
    const { data: reports } = await supabase
      .from("reports")
      .select("id, reason, created_at, booking_id, reporter:profiles!reports_reporter_id_fkey(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    content = (
      <section className="flex flex-col gap-3">
        <SectionTitle>{t("reportsList")}</SectionTitle>
        {(reports ?? []).length === 0 ? <EmptyState>{t("noReports")}</EmptyState> : null}
        {(reports ?? []).map((r) => (
          <Card key={r.id} className="flex flex-col gap-2">
            <span className="text-xs text-ink-muted">
              {t("reportedBy", { name: r.reporter?.full_name ?? "—" })} · {formatDateTime(r.created_at, locale)}
            </span>
            <p className="whitespace-pre-line text-sm">{r.reason}</p>
            {r.booking_id ? (
              <Link href={`/bookings/${r.booking_id}`} className="text-sm font-semibold text-brand-700 underline">
                {t("open")}
              </Link>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton action={decideReport} fields={{ id: r.id, handled: "1" }}>{t("resolve")}</ActionButton>
              <ActionButton action={decideReport} fields={{ id: r.id, handled: "0" }} variant="secondary">{t("dismiss")}</ActionButton>
            </div>
          </Card>
        ))}
      </section>
    );
  }

  if (tab === "members") {
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name, grade, city, is_premium, is_admin, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200);
    content = (
      <section className="flex flex-col gap-3">
        <SectionTitle>{t("members")}</SectionTitle>
        {(members ?? []).length === 0 ? <EmptyState>{t("noMembers")}</EmptyState> : null}
        {(members ?? []).map((m) => (
          <Card key={m.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/doctors/${m.id}`} className="flex flex-col">
                <span className="font-bold text-brand-700 underline">{m.full_name}</span>
                <span className="text-sm text-ink-muted">
                  {m.grade ? o(`grade.${m.grade as "resident"}`) : "—"} · {m.city ? o(`city.${m.city as "cairo"}`) : "—"}
                </span>
                <span className="text-xs text-ink-muted">{formatDate(m.created_at, locale)}</span>
              </Link>
              <div className="flex flex-col items-end gap-1">
                {m.is_admin ? <Badge tone="brand">{t("title")}</Badge> : null}
                {m.is_premium ? <Badge tone="gold">{p("premium")}</Badge> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton action={setPremium} fields={{ id: m.id, premium: m.is_premium ? "0" : "1" }} variant="secondary">
                {m.is_premium ? t("removePremium") : t("makePremium")}
              </ActionButton>
              {m.id !== viewer.userId ? (
                <ActionButton action={suspendDoctor} fields={{ id: m.id }} variant="danger" confirm={t("suspend") + "?"}>
                  {t("suspend")}
                </ActionButton>
              ) : null}
            </div>
          </Card>
        ))}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("title")}</PageTitle>
      <nav className="grid grid-cols-5 gap-1 rounded-xl bg-line/50 p-1" aria-label={t("title")}>
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/admin?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`rounded-lg px-1 py-2 text-center text-xs font-semibold ${tab === k ? "bg-surface text-brand-700 shadow-sm" : "text-ink-muted"}`}
          >
            {tabLabel[k]}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  );
}
