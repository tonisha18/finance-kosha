import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseCSV } from "../src/lib/parsers/csv-xlsx";

describe("CSV Statement Parsing with Fixtures", () => {
  it("parses statement with separate Debit and Credit columns", () => {
    const file = fs.readFileSync(path.join(__dirname, "../fixtures/statement_separate_cols.csv"), "utf8");
    const rows = parseCSV(file);
    expect(rows.length).toBe(4);
    expect(rows[0].merchant).toContain("Swiggy");
    expect(rows[0].amount).toBe(450);
    expect(rows[0].type).toBe("debit");
    expect(rows[0].category).toBe("Food & Dining");

    expect(rows[2].type).toBe("credit");
    expect(rows[2].amount).toBe(85000);
    expect(rows[2].category).toBe("Income/Salary");
  });

  it("parses statement with single signed amount column", () => {
    const file = fs.readFileSync(path.join(__dirname, "../fixtures/statement_signed_amount.csv"), "utf8");
    const rows = parseCSV(file);
    expect(rows.length).toBe(4);
    expect(rows[0].amount).toBe(350);
    expect(rows[0].type).toBe("debit");
    expect(rows[2].amount).toBe(15000);
    expect(rows[2].type).toBe("credit");
  });

  it("skips bank preamble lines and parses odd format with DR/CR marker", () => {
    const file = fs.readFileSync(path.join(__dirname, "../fixtures/statement_odd_format.csv"), "utf8");
    const rows = parseCSV(file);
    expect(rows.length).toBe(3);
    expect(rows[0].merchant).toContain("Blinkit");
    expect(rows[0].category).toBe("Groceries");
    expect(rows[0].amount).toBe(850);
    expect(rows[0].type).toBe("debit");
    expect(rows[2].category).toBe("Income/Salary");
    expect(rows[2].type).toBe("credit");
  });
});
