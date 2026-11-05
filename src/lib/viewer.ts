import "server-only";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { REQUIRED_DOCS, type DocType } from "@/lib/constants";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The signed-in doctor's profile. Phone numbers are not readable directly
 * (migration 018); use getContactPhones() from lib/contacts when needed.
 */
export type Profile = Omit<Database["public"]["Tables"]["profiles"]["Row"], "phone">;

/** Every profile column doctors may read (all except phone). */
export const PROFILE_COLUMNS =
  "id, full_name, city, grade, photo_url, status, is_premium, is_admin, created_at, max_groups, suspended_reason, show_phone" as const;
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

export type Viewer = {
  userId: string;
  email: string | null;
  profile: Profile;
};

/** The signed-in user and their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  // The session cookie says who is probably signed in, so the profile can be
  // loaded at the same time as getUser() checks the sign-in with Supabase.
  // The profile is only used if getUser() confirms the same user.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const guessedId = session?.user.id;
  const [
    {
      data: { user },
    },
    early,
  ] = await Promise.all([
    supabase.auth.getUser(),
    guessedId
      ? supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", guessedId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!user) return null;

  let profile = early.data && early.data.id === user.id ? early.data : null;
  if (!profile) {
    ({ data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single());
  }
  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
});

/** Must be signed in, otherwise go to the sign-in page. */
export async function requireUser(locale: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect({ href: "/sign-in", locale: locale as Locale });
  return viewer!;
}

/** Must be an approved doctor, otherwise go to the account status page. */
export async function requireApproved(locale: string): Promise<Viewer> {
  const viewer = await requireUser(locale);
  if (viewer.profile.status !== "approved") {
    redirect({ href: "/status", locale: locale as Locale });
  }
  return viewer;
}

/** Must be an app admin, otherwise go home. */
export async function requireAdmin(locale: string): Promise<Viewer> {
  const viewer = await requireUser(locale);
  if (!viewer.profile.is_admin) redirect({ href: "/", locale: locale as Locale });
  return viewer;
}

/** Latest uploaded document of each required type for the signed-in user. */
export async function getMyLatestDocs(
  userId: string,
): Promise<Partial<Record<DocType, DocumentRow>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const latest: Partial<Record<DocType, DocumentRow>> = {};
  for (const doc of data ?? []) {
    const type = doc.type as DocType;
    if (REQUIRED_DOCS.includes(type) && !latest[type]) latest[type] = doc;
  }
  return latest;
}

export function profileComplete(profile: Profile): boolean {
  return Boolean(profile.full_name?.trim() && profile.grade && profile.city);
}

/** Document types that still need an upload (missing or rejected). */
export function docsToUpload(
  latest: Partial<Record<DocType, DocumentRow>>,
): DocType[] {
  return REQUIRED_DOCS.filter(
    (t) => !latest[t] || latest[t]!.status === "rejected",
  );
}
