// Fixed lists used in forms and filters. Labels live in messages/*.json
// under "Options", keyed by these values.

export const CITIES = [
  "cairo",
  "giza",
  "alexandria",
  "qalyubia",
  "sharqia",
  "dakahlia",
  "gharbia",
  "monufia",
  "beheira",
  "kafr_el_sheikh",
  "damietta",
  "port_said",
  "ismailia",
  "suez",
  "fayoum",
  "beni_suef",
  "minya",
  "assiut",
  "sohag",
  "qena",
  "luxor",
  "aswan",
  "red_sea",
  "matrouh",
  "north_sinai",
  "south_sinai",
  "new_valley",
] as const;

export const GRADES = ["resident", "specialist", "consultant"] as const;
export const SHIFT_TYPES = ["shift", "per_case", "replacement"] as const;
export const PAYMENT_TYPES = ["immediate", "on_date"] as const;
export const WORKLOADS = ["light", "moderate", "heavy"] as const;
export const SUBSPECIALTIES = [
  "general",
  "cardiac",
  "pediatric",
  "obstetric",
  "icu",
  "regional",
  "neuro",
  "other",
] as const;

/** Documents every doctor uploads before review. */
export const REQUIRED_DOCS = [
  "syndicate_card",
  "license",
  "certificate",
  "selfie",
] as const;

export type City = (typeof CITIES)[number];
export type Grade = (typeof GRADES)[number];
export type DocType = (typeof REQUIRED_DOCS)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
