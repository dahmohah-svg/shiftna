"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const KEY = "shiftna-opened";

/**
 * Tells the database the doctor opened Shiftna today (for "active doctors"
 * on the admin growth dashboard). At most once a day per phone; the database
 * also keeps only one record per doctor per day.
 */
export default function TrackOpen() {
  useEffect(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
    try {
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
    } catch {
      // Private mode: the database still keeps one record a day.
    }
    createClient().rpc("track_open").then(() => undefined);
  }, []);
  return null;
}
