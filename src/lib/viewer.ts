import "server-only";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { REQUIRED_DOCS, type DocType } from "@/lib/constants";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

export type Viewer = {
  userId: string;
  email: string | null;
  profile: Profile;
};

/** The signed-in user and their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
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
