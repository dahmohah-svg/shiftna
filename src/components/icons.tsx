import {
  Baby,
  Brain,
  CirclePlus,
  HeartPulse,
  MonitorDot,
  Stethoscope,
  Syringe,
  Venus,
  type LucideIcon,
} from "lucide-react";

/** One icon per anesthesia subspecialty, so a case type reads at a glance. */
export const SUBSPECIALTY_ICON: Record<string, LucideIcon> = {
  general: Stethoscope,
  cardiac: HeartPulse,
  pediatric: Baby,
  obstetric: Venus,
  icu: MonitorDot,
  regional: Syringe,
  neuro: Brain,
  other: CirclePlus,
};

export function SubspecialtyIcon({ value, className = "h-3.5 w-3.5" }: { value: string; className?: string }) {
  const Icon = SUBSPECIALTY_ICON[value] ?? CirclePlus;
  return <Icon className={className} aria-hidden strokeWidth={2.25} />;
}
