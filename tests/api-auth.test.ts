import { describe, it, expect, vi } from "vitest";
import { POST as coachPost } from "../src/app/api/coach/route";
import { POST as reportPost } from "../src/app/api/report/route";
import { POST as alertsRunPost } from "../src/app/api/alerts/run/route";
import { GET as cronGet } from "../src/app/api/cron/daily/route";
import { NextRequest } from "next/server";

// Mock supabase server client to simulate unauthenticated user
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

describe("API Authentication & Security Guardrails", () => {
  it("rejects unauthenticated requests to /api/coach with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/coach", {
      method: "POST",
      body: JSON.stringify({ message: "Hello", user_id: "attacker-id" }),
    });
    const res = await coachPost(req);
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated requests to /api/report with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/report", {
      method: "POST",
      body: JSON.stringify({ month: "2026-11", user_id: "attacker-id" }),
    });
    const res = await reportPost(req);
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated requests to /api/alerts/run with 401", async () => {
    const res = await alertsRunPost();
    expect(res.status).toBe(401);
  });

  it("rejects /api/cron/daily when CRON_SECRET is missing or invalid with 401", async () => {
    const reqWithoutAuth = new NextRequest("http://localhost:3000/api/cron/daily", {
      method: "GET",
    });
    const resWithout = await cronGet(reqWithoutAuth);
    expect(resWithout.status).toBe(401);

    const reqWrongSecret = new NextRequest("http://localhost:3000/api/cron/daily", {
      method: "GET",
      headers: { authorization: "Bearer invalid-secret" },
    });
    const resWrong = await cronGet(reqWrongSecret);
    expect(resWrong.status).toBe(401);
  });
});
