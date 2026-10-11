import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import type { AuthConfig, TokenVerifier } from "./auth.js";
import { MemoryStore } from "./storage/memory.js";

const point = (id: string) => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [-77.03, 38.9] },
  properties: { name: "HQ" },
});

// Tokens are "token-<email>"; anything else is rejected.
const verifyToken: TokenVerifier = async (token) => {
  if (!token.startsWith("token-")) throw new Error("bad token");
  return { email: token.slice("token-".length) };
};

const auth = (overrides: Partial<AuthConfig> = {}): AuthConfig => ({
  disabled: false,
  allowedEmails: ["ana@example.com", "@team.example"],
  publicRead: true,
  ...overrides,
});

function setup(authConfig = auth(), allowedOrigins: string[] = []) {
  const store = new MemoryStore();
  const app = createApp({ store, auth: authConfig, verifyToken, allowedOrigins });
  return { app, store };
}

describe("write access", () => {
  it("rejects saves without a token", async () => {
    const { app, store } = setup();
    const res = await request(app).post("/saveannotation").send(point("a1"));
    expect(res.status).toBe(401);
    expect(await store.getAll()).toEqual([]);
  });

  it("rejects invalid tokens", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/saveannotation")
      .set("Authorization", "Bearer forged")
      .send(point("a1"));
    expect(res.status).toBe(401);
  });

  it("rejects signed-in users who aren't on the allowlist", async () => {
    const { app, store } = setup();
    const res = await request(app)
      .post("/saveannotation")
      .set("Authorization", "Bearer token-mallory@example.org")
      .send(point("a1"));
    expect(res.status).toBe(403);
    expect(await store.getAll()).toEqual([]);
  });

  it("lets allowlisted emails and domains save and delete", async () => {
    const { app, store } = setup();
    await request(app)
      .post("/saveannotation")
      .set("Authorization", "Bearer token-ana@example.com")
      .send(point("a1"))
      .expect(200);
    await request(app)
      .post("/saveannotation")
      .set("Authorization", "Bearer token-raj@team.example")
      .send(point("a2"))
      .expect(200);
    expect((await store.getAll()).map((f) => f.id).sort()).toEqual(["a1", "a2"]);

    await request(app)
      .post("/deleteannotation")
      .set("Authorization", "Bearer token-ana@example.com")
      .send({ id: "a1" })
      .expect(200);
    expect((await store.getAll()).map((f) => f.id)).toEqual(["a2"]);
  });

  it("rejects deletes without a token", async () => {
    const { app, store } = setup();
    await store.save(point("a1") as never);
    await request(app).post("/deleteannotation").send({ id: "a1" }).expect(401);
    expect(await store.getAll()).toHaveLength(1);
  });

  it("allows everything when auth is disabled", async () => {
    const store = new MemoryStore();
    const app = createApp({ store, auth: auth({ disabled: true }) });
    await request(app).post("/saveannotation").send(point("a1")).expect(200);
  });

  it("requires a verifier when auth is enabled", () => {
    expect(() => createApp({ store: new MemoryStore(), auth: auth() })).toThrow(/verifyToken/);
  });
});

describe("reads", () => {
  it("are public by default", async () => {
    const { app, store } = setup();
    await store.save(point("a1") as never);
    const res = await request(app).get("/getannotations").expect(200);
    expect(res.body).toEqual({ type: "FeatureCollection", features: [point("a1")] });
  });

  it("require sign-in when PUBLIC_READ is off", async () => {
    const { app } = setup(auth({ publicRead: false }));
    await request(app).get("/getannotations").expect(401);
    await request(app)
      .get("/getannotations")
      .set("Authorization", "Bearer token-ana@example.com")
      .expect(200);
  });
});

describe("validation", () => {
  const save = (app: ReturnType<typeof setup>["app"], body: unknown) =>
    request(app).post("/saveannotation").set("Authorization", "Bearer token-ana@example.com").send(body as object);

  it("rejects ids that aren't safe document ids", async () => {
    const { app } = setup();
    expect((await save(app, point("a/b"))).status).toBe(400);
    expect((await save(app, point(""))).status).toBe(400);
  });

  it("rejects non-features and bad geometry", async () => {
    const { app } = setup();
    expect((await save(app, { hello: "world" })).status).toBe(400);
    expect((await save(app, { ...point("a1"), geometry: { type: "Circle", coordinates: [] } })).status).toBe(400);
    expect((await save(app, { ...point("a1"), properties: [] })).status).toBe(400);
  });

  it("rejects deletes without a valid id", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/deleteannotation")
      .set("Authorization", "Bearer token-ana@example.com")
      .send({ id: "../x" });
    expect(res.status).toBe(400);
  });
});

describe("CORS", () => {
  it("is off by default", async () => {
    const { app } = setup();
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows configured origins only", async () => {
    const { app } = setup(auth(), ["http://localhost:1234"]);
    const ok = await request(app).get("/health").set("Origin", "http://localhost:1234");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:1234");
    const other = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
