import InstallApp from "@/components/InstallApp";
import TabBar from "@/components/TabBar";
import TrackOpen from "@/components/TrackOpen";
import { createClient } from "@/lib/supabase/server";
import { isHr, requireApproved } from "@/lib/viewer";

// Everything inside (app) is only for approved doctors and hospital HR.
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const viewer = await requireApproved(locale);

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.userId)
    .is("read_at", null);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <div className="no-print">
          <InstallApp variant="banner" />
        </div>
        {children}
      </main>
      <TabBar userId={viewer.userId} initialUnread={count ?? 0} hr={isHr(viewer.profile)} />
      <TrackOpen />
    </>
  );
}
