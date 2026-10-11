import { describe, expect, it } from "vitest";
import { authConfigFromEnv, bearerToken, isAllowed, parseAllowlist } from "./auth.js";

describe("allowlist", () => {
  const list = parseAllowlist(" Ana@Example.com, @team.example ,,");

  it("parses, trims and lowercases entries", () => {
    expect(list).toEqual(["ana@example.com", "@team.example"]);
  });

  it("matches exact emails case-insensitively", () => {
    expect(isAllowed("ANA@example.com", list)).toBe(true);
    expect(isAllowed("ana@example.org", list)).toBe(false);
  });

  it("matches whole domains, not lookalikes", () => {
    expect(isAllowed("raj@team.example", list)).toBe(true);
    expect(isAllowed("raj@evilteam.example", list)).toBe(false);
    expect(isAllowed("raj@team.example.evil", list)).toBe(false);
    expect(isAllowed("team.example", list)).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer   abc")).toBe("abc");
  });

  it("returns null for anything else", () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
  });
});

describe("authConfigFromEnv", () => {
  it("refuses to run without an allowlist unless auth is disabled", () => {
    expect(() => authConfigFromEnv({})).toThrow(/ALLOWED_EMAILS/);
    expect(authConfigFromEnv({ AUTH_DISABLED: "true" }).disabled).toBe(true);
  });

  it("defaults to public reads", () => {
    expect(authConfigFromEnv({ ALLOWED_EMAILS: "a@b.c" }).publicRead).toBe(true);
    expect(authConfigFromEnv({ ALLOWED_EMAILS: "a@b.c", PUBLIC_READ: "false" }).publicRead).toBe(false);
  });
});
