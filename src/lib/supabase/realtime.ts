import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Opens a Realtime channel as the signed-in user. Without the session token
 * Row Level Security treats the connection as anonymous and sends nothing.
 * Returns a cleanup function for useEffect.
 */
export function subscribeAsUser(
  supabase: SupabaseClient,
  build: (supabase: SupabaseClient) => RealtimeChannel,
): () => void {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  (async () => {
    const { data } = await supabase.auth.getSession();
    if (cancelled) return;
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (cancelled) return;
    channel = build(supabase).subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}
