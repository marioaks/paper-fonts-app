/**
 * Extract and normalize a US/Canada phone number from arbitrary page text.
 * Returns an E.164-style string (e.g. "+15551234567") or null if the text does
 * not contain a plausible phone number (e.g. an email-only member).
 */
export function normalizePhone(rawText: string | null | undefined): string | null {
  if (!rawText) return null;

  // If there's an email and no digit-rich phone, treat as no phone.
  const digits = rawText.replace(/[^\d+]/g, "");
  const onlyDigits = digits.replace(/\D/g, "");

  // Reject things that are clearly not phone numbers.
  if (onlyDigits.length < 10) return null;

  if (digits.startsWith("+")) {
    // Already international; keep leading + and digits.
    const intl = "+" + onlyDigits;
    return intl.length >= 11 ? intl : null;
  }

  if (onlyDigits.length === 10) return "+1" + onlyDigits;
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1")) return "+" + onlyDigits;

  // Longer strings are ambiguous (could include other numbers on the page);
  // grab the last 10 digits as a best effort only if exactly 10 or 11 matched
  // above. Otherwise bail to avoid texting a wrong number.
  return null;
}

/** True if the page text contains a usable phone number. */
export function hasPhone(rawText: string | null | undefined): boolean {
  return normalizePhone(rawText) !== null;
}
