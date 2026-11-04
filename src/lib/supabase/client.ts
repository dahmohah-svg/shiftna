import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Supabase client for browser code (uploads and live chat). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
