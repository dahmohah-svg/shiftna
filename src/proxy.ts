import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// 1) Sends visitors to /ar or /en and remembers their chosen language.
// 2) Keeps the Supabase sign-in session fresh on every page load.
export default async function proxy(request: NextRequest) {
  const response = intl(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on every page except API routes, Next.js internals and static files
  // (anything with a dot, such as manifest.webmanifest or icon-192.png).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
