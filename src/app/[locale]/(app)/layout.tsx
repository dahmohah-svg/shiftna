import TabBar from "@/components/TabBar";
import { requireApproved } from "@/lib/viewer";

// Everything inside (app) is only for approved doctors.
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  await requireApproved(locale);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        {children}
      </main>
      <TabBar />
    </>
  );
}
