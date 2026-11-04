import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Sends visitors to /ar or /en and remembers their chosen language.
export default createMiddleware(routing);

export const config = {
  // Run on every page except API routes, Next.js internals and static files
  // (anything with a dot, such as manifest.webmanifest or icon-192.png).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
