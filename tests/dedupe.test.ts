import { describe, it, expect } from "vitest";
import { computeDedupeHash } from "../src/lib/dedupe";

describe("Deduplication Hash Stability", () => {
  it("produces identical hashes for identical transactions", () => {
    const h1 = computeDedupeHash("user123", "2026-11-21", 450.5, "Swiggy Bangalore", "debit");
    const h2 = computeDedupeHash("user123", "2026-11-21", 450.5, "Swiggy Bangalore", "debit");
    expect(h1).toBe(h2);
  });

  it("produces distinct hashes across different users or amounts", () => {
    const h1 = computeDedupeHash("user1", "2026-11-21", 450, "Swiggy", "debit");
    const h2 = computeDedupeHash("user2", "2026-11-21", 450, "Swiggy", "debit");
    const h3 = computeDedupeHash("user1", "2026-11-21", 550, "Swiggy", "debit");
    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
  });
});
