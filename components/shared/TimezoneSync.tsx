"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * Relays the browser's IANA timezone to the server via a cookie so Server
 * Components (dashboard, progress) compute streaks against the patient's local
 * day rather than UTC. Renders nothing.
 *
 * On first load the cookie is absent, so the server falls back to UTC; this
 * component then writes the cookie and refreshes once so the corrected value
 * is used. Subsequent visits read the cookie directly with no refresh.
 */
export default function TimezoneSync(): null {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TIMEZONE_COOKIE}=`))
      ?.split("=")[1];

    if (current === tz) return;

    // 1-year persistent cookie; Lax is sufficient (same-site navigation only).
    document.cookie = `${TIMEZONE_COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
