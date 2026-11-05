import "server-only";
import { cookies } from "next/headers";

/** Confirmations shown by <Toaster />; text lives under "Toast" in messages. */
export const FLASH_KEYS = [
  "shiftPosted",
  "offerSent",
  "offerWithdrawn",
  "bookingConfirmed",
  "offerDeclined",
  "shiftCancelled",
  "markedCompleted",
  "paymentUpdated",
  "noShowRecorded",
  "bookingCancelled",
  "ratingSubmitted",
  "reportSent",
  "detailsSaved",
  "documentUploaded",
  "doctorApproved",
  "doctorRejected",
  "hospitalAdded",
  "hospitalUpdated",
  "hospitalsMerged",
  "reportHandled",
  "premiumUpdated",
  "accountPaused",
  "teamSubmitted",
  "joinRequested",
  "teamJoined",
  "memberUpdated",
  "leftTeam",
  "teamReviewed",
  "codeRenewed",
  "memberReadded",
  "rejoinAllowed",
  "alertSaved",
  "alertDeleted",
] as const;
export type FlashKey = (typeof FLASH_KEYS)[number];

export const FLASH_COOKIE = "shiftna-flash";

/**
 * Leaves a one-time confirmation for the browser. It survives a redirect,
 * so "Booking confirmed" still shows after accepting opens the booking.
 */
export async function flash(key: FlashKey) {
  (await cookies()).set(FLASH_COOKIE, key, { path: "/", maxAge: 60, sameSite: "lax", httpOnly: false });
}
