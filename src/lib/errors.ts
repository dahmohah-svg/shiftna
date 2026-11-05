import type { PostgrestError, AuthError } from "@supabase/supabase-js";

/** Keys under "Errors" in messages/*.json. */
export type ErrorKey =
  | "generic"
  | "invalid"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userExists"
  | "weakPassword"
  | "rateLimited"
  | "notApproved"
  | "shiftNotOpen"
  | "notYourShift"
  | "overlap"
  | "gradeTooLow"
  | "alreadyOffered"
  | "alreadyCancelled"
  | "notYourBooking"
  | "alreadyRated"
  | "notAllowed"
  | "fileTooBig"
  | "fileType"
  | "uploadFailed"
  | "needsPremium"
  | "tooManyTeams"
  | "invalidCode"
  | "tooManyHospitals"
  | "hospitalExists";

/** Result returned by every server action. */
export type ActionState = {
  ok?: boolean;
  error?: ErrorKey;
  /** Extra, non-translated key for a form-specific message. */
  message?: string;
};

const DB_MESSAGES: [RegExp, ErrorKey][] = [
  [/not approved/i, "notApproved"],
  [/shift is not open|no longer open/i, "shiftNotOpen"],
  [/not your shift/i, "notYourShift"],
  [/overlap/i, "overlap"],
  [/grade is below|grade_rank/i, "gradeTooLow"],
  [/already cancelled/i, "alreadyCancelled"],
  [/not your booking/i, "notYourBooking"],
  [/needs premium/i, "needsPremium"],
  [/does not allow more groups/i, "tooManyTeams"],
  [/invalid code/i, "invalidCode"],
  [/too many hospitals/i, "tooManyHospitals"],
  [/hospital name must be/i, "invalid"],
  [/not allowed/i, "notAllowed"],
];

/** Turns a database or auth error into a friendly message key. */
export function toErrorKey(
  error: PostgrestError | AuthError | { message?: string; code?: string } | null,
): ErrorKey {
  if (!error) return "generic";
  const msg = error.message ?? "";
  const code = "code" in error ? String(error.code ?? "") : "";

  if (code === "23505") {
    if (/offers/.test(msg)) return "alreadyOffered";
    if (/ratings/.test(msg)) return "alreadyRated";
    if (/hospitals/.test(msg)) return "hospitalExists";
  }
  if (code === "42501" || /row-level security/i.test(msg)) return "notAllowed";
  if (/invalid login credentials/i.test(msg)) return "invalidCredentials";
  if (/email not confirmed/i.test(msg)) return "emailNotConfirmed";
  if (/already registered|user_already_exists/i.test(msg + code))
    return "userExists";
  if (/password/i.test(msg) && /weak|short|characters/i.test(msg))
    return "weakPassword";
  if (/rate limit|too many/i.test(msg) || code === "over_email_send_rate_limit")
    return "rateLimited";

  for (const [re, key] of DB_MESSAGES) if (re.test(msg)) return key;
  console.error("Unmapped error", { code, msg });
  return "generic";
}
