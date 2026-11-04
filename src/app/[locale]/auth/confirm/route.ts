import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// The link in the sign-up email lands here. It signs the user in and
// sends them on to finish their profile.
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/[locale]/auth/confirm">,
) {
  const { locale } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = ok ? `/${locale}/onboarding` : `/${locale}/sign-in?confirm=failed`;
  return NextResponse.redirect(new URL(target, url.origin));
}
