import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";

/** Simple centred layout for sign-in, sign-up and status screens. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 flex-col gap-5 pt-6">{children}</main>
    </div>
  );
}
