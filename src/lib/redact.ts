/**
 * PII Firewall: pure function to scrub sensitive identifiers BEFORE any LLM call or storage.
 * Safe order applied: Emails, PAN, IFSC, Phones (strict 10-digits), Card numbers, Account/UPI references.
 * Ensures amounts like "1,24,500.00" and dates like "2026-11-21" or "15/10/2026" are NOT redacted.
 */

export function redactPII(text: string): string {
  if (!text) return "";

  let result = text;

  // 1. Email addresses
  result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]");

  // 2. PAN (Permanent Account Number): 5 uppercase letters, 4 digits, 1 uppercase letter
  result = result.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN_REDACTED]");

  // 3. IFSC codes: 4 letters, 0, 6 alphanumeric
  result = result.replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[IFSC_REDACTED]");

  // 4. Indian phone numbers: optional +91 or +91- or +91 [space], followed by 10 digits starting with 6-9
  // Uses negative lookahead and lookbehind so 11-18 digit account numbers are not truncated into phones
  result = result.replace(/(?<!\d)(?:\+91[\-\s]?)?[6-9]\d{9}(?!\d)/g, "[PHONE_REDACTED]");

  // 5. Card-like sequences: 13-19 digits (with spaces or dashes between 4-digit groups)
  result = result.replace(/\b(?:\d{4}[\s\-]){3,4}\d{1,4}\b/g, "[CARD_REDACTED]");

  // 6. Account & UPI reference numbers: continuous 9 to 18 digits
  result = result.replace(/\b\d{9,18}\b/g, "[ACCT_REDACTED]");

  return result;
}
