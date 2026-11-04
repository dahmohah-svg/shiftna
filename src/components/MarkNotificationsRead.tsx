"use client";

import { useEffect } from "react";
import { markAllRead } from "@/app/actions/notifications";
import { NOTIFICATIONS_READ_EVENT } from "./TabBar";

/** Marks notifications read once the list has actually been shown. */
export default function MarkNotificationsRead() {
  useEffect(() => {
    markAllRead().then(() => window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT)));
  }, []);
  return null;
}
