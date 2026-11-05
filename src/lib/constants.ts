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

/** Grades, lowest first. Interns are below residents (migration 021). */
export const GRADES = ["intern", "resident", "specialist", "consultant"] as const;
export const SHIFT_TYPES = ["shift", "per_case", "replacement"] as const;
export const PAYMENT_TYPES = ["immediate", "on_date"] as const;
export const WORKLOADS = ["light", "moderate", "heavy"] as const;

/** Specialties Shiftna covers. Labels live under "Options.specialty". */
export const SPECIALTIES = ["anesthesia", "internal_medicine", "emergency", "surgery", "icu", "pediatrics"] as const;

/**
 * Sub-specialties per specialty (labels under "Options.subspecialty"; shared
 * keys like "general" or "pediatric" read naturally in each specialty).
 */
export const SUBSPECIALTIES_BY_SPECIALTY = {
  anesthesia: ["general", "cardiac", "pediatric", "obstetric", "icu", "regional", "neuro", "other"],
  internal_medicine: ["general", "cardiology", "gastroenterology", "chest", "nephrology", "endocrinology", "hematology", "rheumatology", "neuro", "other"],
  emergency: ["general", "trauma", "pediatric", "other"],
  surgery: ["general", "orthopedics", "urology", "neurosurgery", "cardiothoracic", "vascular", "plastic", "pediatric", "ent", "other"],
  icu: ["general", "cardiac", "neuro", "pediatric", "neonatal", "other"],
  pediatrics: ["general", "neonatal", "icu", "cardiology", "other"],
} as const;

/** Every sub-specialty value (the database enum). */
export const SUBSPECIALTIES = [
  "general",
  "cardiac",
  "pediatric",
  "obstetric",
  "icu",
  "regional",
  "neuro",
  "other",
  "cardiology",
  "gastroenterology",
  "chest",
  "nephrology",
  "endocrinology",
  "hematology",
  "rheumatology",
  "trauma",
  "orthopedics",
  "urology",
  "neurosurgery",
  "cardiothoracic",
  "vascular",
  "plastic",
  "ent",
  "neonatal",
] as const;

/** Every document type a doctor can upload. */
export const DOC_TYPES = ["syndicate_card", "license", "certificate", "internship_letter", "selfie"] as const;

/** Documents a doctor uploads before review: interns have no license or certificate yet. */
export function requiredDocsFor(grade: string | null | undefined): readonly DocType[] {
  return grade === "intern"
    ? (["syndicate_card", "internship_letter", "selfie"] as const)
    : (["syndicate_card", "license", "certificate", "selfie"] as const);
}

export type City = (typeof CITIES)[number];
export type Grade = (typeof GRADES)[number];
export type Specialty = (typeof SPECIALTIES)[number];
export type Subspecialty = (typeof SUBSPECIALTIES)[number];
export type DocType = (typeof DOC_TYPES)[number];

/** Sub-specialties for one specialty (all of them when none is chosen). */
export function subspecialtiesFor(specialty: string | null | undefined): readonly Subspecialty[] {
  return specialty && specialty in SUBSPECIALTIES_BY_SPECIALTY
    ? SUBSPECIALTIES_BY_SPECIALTY[specialty as Specialty]
    : SUBSPECIALTIES;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Most saved shift alerts one doctor can keep. */
export const MAX_ALERTS = 10;

/**
 * Everything is free during the pilot: every approved doctor gets the
 * Premium features (migration 016 does the same in the database). Set to
 * false, and restore is_premium() in the database, to start charging.
 */
export const EVERYTHING_FREE = true;
