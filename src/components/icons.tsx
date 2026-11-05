import {
  Baby,
  Bandage,
  Bone,
  Brain,
  CirclePlus,
  Droplet,
  Droplets,
  Ear,
  FlaskConical,
  HandHeart,
  Heart,
  HeartPulse,
  Milk,
  MonitorDot,
  Pill,
  Sparkles,
  Stethoscope,
  Syringe,
  TestTube,
  Venus,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";

/** One icon per sub-specialty, so a case type reads at a glance. */
export const SUBSPECIALTY_ICON: Record<string, LucideIcon> = {
  general: Stethoscope,
  cardiac: HeartPulse,
  pediatric: Baby,
  obstetric: Venus,
  icu: MonitorDot,
  regional: Syringe,
  neuro: Brain,
  other: CirclePlus,
  cardiology: HeartPulse,
  gastroenterology: Pill,
  chest: Wind,
  nephrology: Droplets,
  endocrinology: FlaskConical,
  hematology: Droplet,
  rheumatology: HandHeart,
  trauma: Bandage,
  orthopedics: Bone,
  urology: TestTube,
  neurosurgery: Brain,
  cardiothoracic: Heart,
  vascular: Waves,
  plastic: Sparkles,
  ent: Ear,
  neonatal: Milk,
};

export function SubspecialtyIcon({ value, className = "h-3.5 w-3.5" }: { value: string; className?: string }) {
  const Icon = SUBSPECIALTY_ICON[value] ?? CirclePlus;
  return <Icon className={className} aria-hidden strokeWidth={2.25} />;
}
