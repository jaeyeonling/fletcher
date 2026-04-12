import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyAdminKey } from "../admin-auth";
import { NextRequest } from "next/server";

describe("verifyAdminKey", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_KEY", "test-secret-key");
  });

  it("returns null (success) with valid header key", () => {
    const req = new NextRequest("http://localhost/api/admin/sessions", {
      headers: { "x-admin-key": "test-secret-key" },
    });
    expect(verifyAdminKey(req)).toBeNull();
  });

  it("returns null (success) with valid query param key", () => {
    const req = new NextRequest("http://localhost/api/admin/sessions?key=test-secret-key");
    expect(verifyAdminKey(req)).toBeNull();
  });

  it("returns 401 with wrong key", () => {
    const req = new NextRequest("http://localhost/api/admin/sessions", {
      headers: { "x-admin-key": "wrong-key" },
    });
    const result = verifyAdminKey(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 with no key", () => {
    const req = new NextRequest("http://localhost/api/admin/sessions");
    const result = verifyAdminKey(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 500 when ADMIN_KEY not configured", () => {
    vi.stubEnv("ADMIN_KEY", "");
    const req = new NextRequest("http://localhost/api/admin/sessions", {
      headers: { "x-admin-key": "anything" },
    });
    const result = verifyAdminKey(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
  });
});
