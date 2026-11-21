import { describe, it, expect } from "vitest";
import { parseSingleSMS, parseSMSBatch } from "../src/lib/parsers/sms";

describe("SMS Ingestion Parser", () => {
  it("parses HDFC bank debit SMS", () => {
    const sms = "Dear Customer, INR 450.00 debited from A/c 1234 on 12-10-2026 to Swiggy. UPI Ref 12345.";
    const parsed = parseSingleSMS(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(450);
    expect(parsed?.type).toBe("debit");
    expect(parsed?.category).toBe("Food & Dining");
  });

  it("parses SBI salary credit SMS", () => {
    const sms = "Your A/c 5678 credited with Rs 85,000.00 on 31-10-2026 by Salary Oct 2026.";
    const parsed = parseSingleSMS(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(85000);
    expect(parsed?.type).toBe("credit");
    expect(parsed?.category).toBe("Income/Salary");
  });

  it("parses ICICI UPI payment SMS", () => {
    const sms = "UPI payment of Rs 1,299.00 to Netflix successful on 2026-10-15.";
    const parsed = parseSingleSMS(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1299);
    expect(parsed?.type).toBe("debit");
    expect(parsed?.category).toBe("Entertainment & Subscriptions");
  });

  it("parses multiple SMS blocks from a batch", () => {
    const batch = `
INR 250.00 debited on 01/11/2026 to Uber. Ref 111.

Rs 1,500.00 debited on 02/11/2026 to Zepto. Ref 222.

A/c credited with Rs 5,000.00 on 05/11/2026 by Dividend.
`;
    const list = parseSMSBatch(batch);
    expect(list.length).toBe(3);
    expect(list[0].category).toBe("Transport");
    expect(list[1].category).toBe("Groceries");
    expect(list[2].type).toBe("credit");
  });
});
