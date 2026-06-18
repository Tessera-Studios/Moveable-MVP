/** Cookie name used to relay the client's IANA timezone to Server Components. */
export const TIMEZONE_COOKIE = "tz";

/**
 * Validates an IANA timezone string (e.g. "America/Barbados") using the
 * runtime's own database. Returns false for anything Intl cannot resolve.
 */
export function isValidTimezone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
