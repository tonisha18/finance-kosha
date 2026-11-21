import { lookupMerchantDictionary } from "../merchants";
import { CategoryName } from "../categories";
import { normalizeDate } from "./csv-xlsx";

export interface ParsedSMSTransaction {
  date: string;
  merchant: string;
  raw_description: string;
  amount: number;
  type: "debit" | "credit";
  category?: CategoryName;
}

// Common Indian Bank & UPI SMS patterns (HDFC, SBI, ICICI, Axis, Kotak, Paytm, PhonePe, Cred, etc.)
const SMS_PATTERNS = [
  // 1. Debited by Rs X on Date to VPA / Merchant
  /(?:debited|spent|paid)\s*(?:by|for|of)?\s*(?:rs\.?|inr)\s*([\d,]+\.?\d*)\s*(?:on|at)\s*([\d\-\/a-zA-Z]+)\s*(?:to|at|for)\s*([^.,\n]+)/i,

  // 2. Rs X debited from A/c ... to VPA/Merchant on Date
  /(?:rs\.?|inr)\s*([\d,]+\.?\d*)\s*debited\s*(?:from|for)?\s*.*?(?:to|at)\s*([^.,\n]+?)\s*(?:on|at)\s*([\d\-\/a-zA-Z]+)/i,

  // 3. Credited with Rs X on Date from Source
  /(?:credited|received)\s*(?:with|by|of)?\s*(?:rs\.?|inr)\s*([\d,]+\.?\d*)\s*(?:on|at)\s*([\d\-\/a-zA-Z]+)\s*(?:from|by)\s*([^.,\n]+)/i,

  // 4. Rs X credited to A/c ... on Date by Source
  /(?:rs\.?|inr)\s*([\d,]+\.?\d*)\s*credited\s*.*?(?:on|at)\s*([\d\-\/a-zA-Z]+)\s*(?:from|by|info:)\s*([^.,\n]+)/i,

  // 5. UPI payment of Rs X to Merchant successful on Date
  /payment of\s*(?:rs\.?|inr)\s*([\d,]+\.?\d*)\s*to\s*([^.,\n]+)\s*successful\s*(?:on|at)\s*([\d\-\/a-zA-Z]+)/i,
];

export function parseSingleSMS(message: string): ParsedSMSTransaction | null {
  const clean = message.trim();
  if (!clean) return null;

  const isCredit = /credit|credited|received/i.test(clean) && !/debit|debited|spent/i.test(clean);
  const type: "debit" | "credit" = isCredit ? "credit" : "debit";

  // Try regex patterns
  for (const pattern of SMS_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      let rawAmt: string;
      let rawDate: string;
      let rawMerchant: string;

      // Handle parameter positions based on regex group captures
      if (pattern.source.startsWith("(?:debited|spent|paid)")) {
        rawAmt = match[1];
        rawDate = match[2];
        rawMerchant = match[3];
      } else if (pattern.source.includes("credited") && pattern.source.startsWith("(?:credited|received)")) {
        rawAmt = match[1];
        rawDate = match[2];
        rawMerchant = match[3];
      } else if (pattern.source.includes("payment of")) {
        rawAmt = match[1];
        rawMerchant = match[2];
        rawDate = match[3];
      } else {
        rawAmt = match[1];
        rawMerchant = match[2];
        rawDate = match[3];
      }

      const amount = parseFloat(rawAmt.replace(/,/g, ""));
      const date = normalizeDate(rawDate) || new Date().toISOString().slice(0, 10);
      const merchant = rawMerchant.trim().replace(/^vpa\s*/i, "").slice(0, 40);

      if (!isNaN(amount) && amount > 0) {
        const category = lookupMerchantDictionary(clean) || lookupMerchantDictionary(merchant);
        return {
          date,
          merchant,
          raw_description: clean,
          amount: Math.round(amount * 100) / 100,
          type,
          category: category || undefined,
        };
      }
    }
  }

  // Fallback heuristic: extract amount and use today's date if valid
  const amtMatch = clean.match(/(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i);
  if (amtMatch) {
    const amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    if (!isNaN(amount) && amount > 0) {
      const merchantMatch = clean.match(/(?:to|at|for|from|vpa)\s+([A-Za-z0-9\s]+?)(?:on|\.|\,|$)/i);
      const merchant = merchantMatch ? merchantMatch[1].trim().slice(0, 30) : "Bank Transaction";
      const dateMatch = clean.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
      const date = dateMatch ? normalizeDate(dateMatch[1]) || new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const category = lookupMerchantDictionary(clean) || lookupMerchantDictionary(merchant);

      return {
        date,
        merchant,
        raw_description: clean,
        amount: Math.round(amount * 100) / 100,
        type,
        category: category || undefined,
      };
    }
  }

  return null;
}

export function parseSMSBatch(text: string): ParsedSMSTransaction[] {
  // Split on double newlines or lines starting with typical bank SMS prefixes
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 15);
  const results: ParsedSMSTransaction[] = [];

  for (const block of blocks) {
    const tx = parseSingleSMS(block);
    if (tx) results.push(tx);
  }

  return results;
}
