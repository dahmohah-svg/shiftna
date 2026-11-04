import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Language-aware versions of Next.js navigation helpers.
// Use these instead of next/link and next/navigation inside the app.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
