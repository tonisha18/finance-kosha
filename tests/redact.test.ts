import { describe, it, expect } from "vitest";
import { redactPII } from "../src/lib/redact";

describe("PII Firewall (redactPII)", () => {
  it("redacts Indian phone numbers", () => {
    const input = "Contact us at +91 9876543210 or 8765432109 for support.";
    const output = redactPII(input);
    expect(output).toContain("[PHONE_REDACTED]");
    expect(output).not.toContain("9876543210");
    expect(output).not.toContain("8765432109");
  });

  it("redacts IFSC codes", () => {
    const input = "Transferred to HDFC0001234 branch details";
    const output = redactPII(input);
    expect(output).toBe("Transferred to [IFSC_REDACTED] branch details");
  });

  it("redacts PAN numbers", () => {
    const input = "Tax deduction PAN ABCDE1234F verified";
    const output = redactPII(input);
    expect(output).toBe("Tax deduction PAN [PAN_REDACTED] verified");
  });

  it("redacts email addresses", () => {
    const input = "Statement sent to user.name@domain.co.in successfully";
    const output = redactPII(input);
    expect(output).toBe("Statement sent to [EMAIL_REDACTED] successfully");
  });

  it("redacts continuous 9-18 digit account numbers & UPI ref IDs", () => {
    const input = "A/c 123456789012 debited, UPI ref 987654321098";
    const output = redactPII(input);
    expect(output).toContain("[ACCT_REDACTED]");
    expect(output).not.toContain("123456789012");
    expect(output).not.toContain("987654321098");
  });

  it("does NOT redact standard transaction amounts and dates", () => {
    const input = "Debited INR 1,24,500.00 on 2026-11-21 at Swiggy";
    const output = redactPII(input);
    expect(output).toContain("1,24,500.00");
    expect(output).toContain("2026-11-21");
    expect(output).toContain("Swiggy");
  });

  it("handles a combined real-world statement snippet correctly", () => {
    const input =
      "Stmt for customer@gmail.com PAN: ABCDE1234F. HDFC0001234. A/c: 9876543210123. Ph: +91-9876543210. Rs 4,500.50 debited on 15/10/2026.";
    const output = redactPII(input);
    expect(output).toContain("[EMAIL_REDACTED]");
    expect(output).toContain("[PAN_REDACTED]");
    expect(output).toContain("[IFSC_REDACTED]");
    expect(output).toContain("[ACCT_REDACTED]");
    expect(output).toContain("[PHONE_REDACTED]");
    expect(output).toContain("Rs 4,500.50");
    expect(output).toContain("15/10/2026");
  });
});
