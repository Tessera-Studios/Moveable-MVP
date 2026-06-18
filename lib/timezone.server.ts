import { cookies } from "next/headers";
import { TIMEZONE_COOKIE, isValidTimezone } from "@/lib/timezone";

/**
 * Reads the client's timezone from the request cookie set by `TimezoneSync`.
 * Falls back to "UTC" when the cookie is absent (first load) or invalid.
 *
 * Server-only: depends on `next/headers`, so it must never be imported into a
 * Client Component. Client code should import the constant/validator from
 * `@/lib/timezone` instead.
 */
export async function getRequestTimezone(): Promise<string> {
  const store = await cookies();
  const value = store.get(TIMEZONE_COOKIE)?.value;
  return value && isValidTimezone(value) ? value : "UTC";
}
