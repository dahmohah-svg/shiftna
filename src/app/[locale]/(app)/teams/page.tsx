import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JoinTeamForm } from "@/components/TeamForms";
import { Badge, buttonClass, Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { EVERYTHING_FREE } from "@/lib/constants";
import type { Locale } from "@/i18n/routing";

export default async function TeamsPage({ params, searchParams }: PageProps<"/[locale]/teams">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 20) : undefined;
  const t = await getTranslations("Teams");
  const supabase = await createClient();

  const [{ data: memberships }, { data: created }, { data: pending }] = await Promise.all([
    supabase
      .from("group_members")
      .select("role, group:groups!group_members_group_id_fkey(id, name, institution, status)")
      .eq("user_id", viewer.userId)
      .eq("status", "active"),
    supabase
      .from("groups")
      .select("id, name, institution, status, reject_reason")
      .eq("created_by", viewer.userId)
      .neq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase.rpc("my_pending_requests"),
  ]);

  const teams = (memberships ?? [])
    .filter((m) => m.group && m.group.status === "approved")
    .sort((a, b) => a.group!.name.localeCompare(b.group!.name));
  const roleLabel = (role: string) => (role === "member" ? null : t(`role.${role as "owner" | "moderator"}`));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>
      <p className="-mt-3 text-sm text-ink-muted">{t("intro")}</p>

      {code ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("joinTitle")}</SectionTitle>
          <JoinTeamForm code={code} />
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>{t("myTeams")}</SectionTitle>
        {teams.length === 0 ? <EmptyState>{t("noTeams")}</EmptyState> : null}
        {teams.map((m) => (
          <Link
            key={m.group!.id}
            href={`/teams/${m.group!.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-bold">{m.group!.name}</span>
              <span className="truncate text-sm text-ink-muted">{m.group!.institution}</span>
            </span>
            {roleLabel(m.role) ? <Badge tone="brand">{roleLabel(m.role)}</Badge> : null}
          </Link>
        ))}
      </section>

      {(pending ?? []).length > 0 || (created ?? []).length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>{t("waiting")}</SectionTitle>
          {(pending ?? []).map((r) => (
            <div key={r.group_id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="font-semibold">{r.group_name}</span>
              <Badge tone="warn">{t("requestPending")}</Badge>
            </div>
          ))}
          {(created ?? []).map((g) => (
            <div key={g.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{g.name}</span>
                <Badge tone={g.status === "rejected" ? "danger" : "warn"}>
                  {t(`teamStatus.${g.status as "pending" | "rejected" | "suspended"}`)}
                </Badge>
              </div>
              {g.status === "rejected" && g.reject_reason ? (
                <Notice tone="danger">{t("rejectedReason", { reason: g.reject_reason })}</Notice>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {!code ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("joinTitle")}</SectionTitle>
          <JoinTeamForm />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t("createTitle")}</SectionTitle>
        <p className="text-sm text-ink-muted">{t("createIntro")}</p>
        {EVERYTHING_FREE || viewer.profile.is_premium ? (
          <Link href="/teams/new" className={buttonClass.secondary}>
            {t("createButton")}
          </Link>
        ) : (
          <Notice>{t("createNeedsPremium")}</Notice>
        )}
      </Card>
    </div>
  );
}
