import Papa from "papaparse";
import * as XLSX from "xlsx";
import { lookupMerchantDictionary } from "../merchants";
import { CategoryName } from "../categories";

export interface ParsedRawRow {
  date: string;
  merchant: string;
  raw_description: string;
  amount: number;
  type: "debit" | "credit";
  category?: CategoryName;
}

/**
 * Parse date string or Excel serial number into YYYY-MM-DD
 */
export function normalizeDate(dateVal: any): string | null {
  if (dateVal === null || dateVal === undefined) return null;

  // 1. If it's a number (or numeric string) between 25000 and 70000 -> Excel serial date
  if (typeof dateVal === "number" || (!isNaN(Number(dateVal)) && String(dateVal).trim().length === 5)) {
    const num = typeof dateVal === "number" ? dateVal : parseFloat(dateVal);
    if (num > 25000 && num < 70000) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + num * 86400000);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
    }
  }

  const clean = String(dateVal).trim();
  if (!clean) return null;

  // 2. Match YYYY-MM-DD (also handles trailing time e.g. "2026-11-20 14:30:00" or "2026-11-20T10:00:00")
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, "0");
    const d = ymdMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 3. Match DD/MM/YYYY or DD-MM-YYYY (also handles trailing time e.g. "15/11/2026 14:30" or "15-11-26")
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    let y = dmyMatch[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m}-${d}`;
  }

  // 4. Textual dates e.g. "12-Oct-2026", "12 Oct 2026", "12-Nov-2026", "Nov 12, 2026"
  const dateOnlyStr = clean.split(/[T,]/)[0].replace(/-/g, " ");
  const parsed = new Date(dateOnlyStr);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Detect column indexes for Date, Description, Debit, Credit, Amount from header row
 */
export function detectColumns(headers: string[]): {
  dateIdx: number;
  descIdx: number;
  debitIdx: number;
  creditIdx: number;
  amountIdx: number;
  typeIdx: number;
} {
  let dateIdx = -1;
  let descIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;
  let amountIdx = -1;
  let typeIdx = -1;

  headers.forEach((h, i) => {
    const norm = String(h || "").toLowerCase().trim();
    if (!norm) return;

    // Date
    if (
      dateIdx === -1 &&
      (norm === "date" ||
        norm.includes("txn date") ||
        norm.includes("transaction date") ||
        norm.includes("value date") ||
        norm.includes("val date") ||
        norm.includes("val dt") ||
        norm.includes("txn dt") ||
        norm.includes("posting date") ||
        norm.includes("booking date") ||
        norm.includes("tran date") ||
        norm.includes("date"))
    ) {
      dateIdx = i;
    }
    // Description / Narration / Particulars
    else if (
      descIdx === -1 &&
      (norm.includes("narration") ||
        norm.includes("particular") ||
        norm.includes("description") ||
        norm.includes("details") ||
        norm.includes("remarks") ||
        norm.includes("merchant") ||
        norm.includes("payee") ||
        norm.includes("beneficiary") ||
        norm.includes("party"))
    ) {
      descIdx = i;
    }
    // Type indicator
    else if (
      norm === "debit/credit" ||
      norm === "cr/dr" ||
      norm === "dr/cr" ||
      norm === "type" ||
      norm === "txn type" ||
      norm === "transaction type"
    ) {
      typeIdx = i;
    }
    // Debit
    else if (
      norm.includes("withdrawal") ||
      norm.includes("debit") ||
      norm === "dr" ||
      norm === "dr amt" ||
      norm === "dr amount" ||
      norm.includes("dr amt")
    ) {
      debitIdx = i;
    }
    // Credit
    else if (
      norm.includes("deposit") ||
      norm.includes("credit") ||
      norm === "cr" ||
      norm === "cr amt" ||
      norm === "cr amount" ||
      norm.includes("cr amt")
    ) {
      creditIdx = i;
    }
    // Generic Amount
    else if (
      amountIdx === -1 &&
      (norm === "amount" ||
        norm.includes("amount") ||
        norm.includes("txn amt") ||
        norm.includes("net amt") ||
        norm.includes("total amt"))
    ) {
      amountIdx = i;
    }
  });

  return { dateIdx, descIdx, debitIdx, creditIdx, amountIdx, typeIdx };
}

/**
 * Clean description to extract readable merchant name
 */
export function extractMerchant(desc: string): string {
  if (!desc) return "Unknown";
  let clean = desc.trim();

  // Remove common banking prefixes
  clean = clean.replace(/^(UPI|NEFT|RTGS|IMPS|POS|ACH|NACH|INB|BILLDESK|RAZORPAY|PAYTM)\s*[\/\-:]?\s*/i, "");
  // Take first section before slash or colon or dash
  const parts = clean.split(/[\/\-@:]/);
  if (parts.length > 0 && parts[0].trim().length > 2) {
    clean = parts[0].trim();
  }

  // Trim numbers or reference garbage
  clean = clean.replace(/\b\d+\b/g, "").trim();
  return clean || desc.slice(0, 30);
}

/**
 * Helper to parse clean number from string with currency signs or commas
 */
function cleanAmountString(val: any): { amount: number; isDebit: boolean; isCredit: boolean } {
  if (val === null || val === undefined) return { amount: 0, isDebit: false, isCredit: false };
  let str = String(val).trim();
  if (!str) return { amount: 0, isDebit: false, isCredit: false };

  let isDebit = false;
  let isCredit = false;

  if (/\b(cr|credit)\b/i.test(str)) isCredit = true;
  if (/\b(dr|debit)\b/i.test(str)) isDebit = true;

  if (str.startsWith("(") && str.endsWith(")")) {
    isDebit = true;
    str = str.slice(1, -1);
  }

  // Remove currency symbols, commas, and whitespace
  str = str.replace(/[₹$€£\s,]|INR|Rs\.?/gi, "").trim();
  const num = parseFloat(str);
  if (isNaN(num)) return { amount: 0, isDebit: false, isCredit: false };

  return {
    amount: Math.abs(num),
    isDebit: isDebit || num < 0,
    isCredit,
  };
}

/**
 * Parse CSV buffer into structured rows
 */
export function parseCSV(content: string): ParsedRawRow[] {
  const parsed = Papa.parse<string[]>(content, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 1) return [];

  // Score candidate header rows up to row 30
  let bestHeaderIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const candidateRow = rows[i].map((c) => String(c).toLowerCase().trim());
    const cols = detectColumns(candidateRow);
    let score = 0;
    if (cols.dateIdx !== -1) score += 3;
    if (cols.descIdx !== -1) score += 3;
    if (cols.debitIdx !== -1 && cols.creditIdx !== -1) score += 4;
    else if (cols.amountIdx !== -1) score += 2;
    if (cols.typeIdx !== -1) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestHeaderIdx = i;
    }
  }

  // If we found a confident header row, use it
  let colMap = bestScore >= 4 ? detectColumns(rows[bestHeaderIdx]) : detectColumns(rows[0]);
  let startRowIdx = bestScore >= 4 ? bestHeaderIdx + 1 : 1;

  // Fallback: If no header found (e.g. raw export with no names), infer columns by value types
  if (colMap.dateIdx === -1 || (colMap.amountIdx === -1 && colMap.debitIdx === -1)) {
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const row = rows[r];
      row.forEach((cell, ci) => {
        if (colMap.dateIdx === -1 && normalizeDate(cell)) {
          colMap.dateIdx = ci;
        } else {
          const { amount } = cleanAmountString(cell);
          if (amount > 0 && colMap.amountIdx === -1) {
            colMap.amountIdx = ci;
          } else if (String(cell).length > 3 && colMap.descIdx === -1 && isNaN(Number(cell))) {
            colMap.descIdx = ci;
          }
        }
      });
    }
    startRowIdx = 0;
  }

  // Check if this file has signed negative amounts
  let hasSignedAmounts = false;
  if (colMap.amountIdx !== -1) {
    for (let i = startRowIdx; i < Math.min(rows.length, 50); i++) {
      const cell = rows[i][colMap.amountIdx];
      const parsed = cleanAmountString(cell);
      if (parsed.isDebit) {
        hasSignedAmounts = true;
        break;
      }
    }
  }

  const results: ParsedRawRow[] = [];

  for (let i = startRowIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const rawDate = colMap.dateIdx !== -1 ? row[colMap.dateIdx] : "";
    const date = normalizeDate(rawDate);
    if (!date) continue;

    const rawDesc = colMap.descIdx !== -1 ? row[colMap.descIdx] : "Unknown";
    const merchant = extractMerchant(rawDesc);

    let amount = 0;
    let type: "debit" | "credit" = "debit";

    if (colMap.debitIdx !== -1 && colMap.creditIdx !== -1) {
      const debitParsed = cleanAmountString(row[colMap.debitIdx]);
      const creditParsed = cleanAmountString(row[colMap.creditIdx]);

      if (debitParsed.amount > 0) {
        amount = debitParsed.amount;
        type = "debit";
      } else if (creditParsed.amount > 0) {
        amount = creditParsed.amount;
        type = "credit";
      }
    } else if (colMap.amountIdx !== -1) {
      const parsedAmt = cleanAmountString(row[colMap.amountIdx]);
      if (parsedAmt.amount > 0) {
        amount = parsedAmt.amount;

        if (colMap.typeIdx !== -1) {
          const typeStr = String(row[colMap.typeIdx] || "").toLowerCase().trim();
          type = typeStr.includes("cr") || typeStr.includes("credit") ? "credit" : "debit";
        } else if (parsedAmt.isCredit) {
          type = "credit";
        } else if (parsedAmt.isDebit) {
          type = "debit";
        } else if (hasSignedAmounts) {
          // If the file uses signed numbers (e.g. -350 is debit), positive is credit
          type = "credit";
        } else {
          // Unsigned column: default to debit unless description indicates income
          const lower = (rawDesc + " " + merchant).toLowerCase();
          if (
            lower.includes("salary") ||
            lower.includes("deposit") ||
            lower.includes("interest credited") ||
            lower.includes("dividend") ||
            lower.includes("refund") ||
            lower.includes("cashback")
          ) {
            type = "credit";
          } else {
            type = "debit";
          }
        }
      }
    }

    if (amount > 0) {
      const dictCategory = lookupMerchantDictionary(rawDesc) || lookupMerchantDictionary(merchant);
      results.push({
        date,
        merchant,
        raw_description: rawDesc,
        amount: Math.round(amount * 100) / 100,
        type,
        category: dictCategory || undefined,
      });
    }
  }

  return results;
}

/**
 * Parse XLSX ArrayBuffer or Buffer into structured rows across sheets
 */
export function parseXLSX(buffer: ArrayBuffer | Buffer): ParsedRawRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  
  // Try each sheet to find the one with actual transaction rows
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { dateNF: "YYYY-MM-DD" });
    const rows = parseCSV(csv);
    if (rows.length > 0) {
      return rows;
    }
  }

  // Fallback to first sheet
  if (wb.SheetNames.length > 0) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(ws, { dateNF: "YYYY-MM-DD" });
    return parseCSV(csv);
  }

  return [];
}
