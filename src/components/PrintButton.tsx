"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

/** Opens the browser's print dialog (which can also save a PDF). */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass.primary} no-print`}>
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
