import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpAnnotationStore, LocalAnnotationStore } from "./api";
import type { Feature } from "./types";

const point = (id: string, name = "HQ"): Feature => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [-77.03, 38.9] },
  properties: { name },
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("LocalAnnotationStore", () => {
  it("saves, updates, and removes features", async () => {
    const store = new LocalAnnotationStore(memoryStorage());
    await store.save(point("a1"));
    await store.save(point("a2"));
    await store.save(point("a1", "Renamed"));
    let fc = await store.getAll();
    expect(fc.features.map((f) => [f.id, f.properties.name])).toEqual([
      ["a2", "HQ"],
      ["a1", "Renamed"],
    ]);

    await store.remove("a2");
    fc = await store.getAll();
    expect(fc.features.map((f) => f.id)).toEqual(["a1"]);
  });

  it("survives corrupt storage", async () => {
    const storage = memoryStorage();
    storage.setItem("gd-annotations", "{not json");
    const store = new LocalAnnotationStore(storage);
    expect((await store.getAll()).features).toEqual([]);
    await store.save(point("a1"));
    expect((await store.getAll()).features).toHaveLength(1);
  });
});

describe("HttpAnnotationStore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends auth headers with writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = new HttpAnnotationStore("http://api", async () => ({ Authorization: "Bearer t" }));
    await store.save(point("a1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api/saveannotation");
    expect(init.headers).toMatchObject({ Authorization: "Bearer t", "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual(point("a1"));
  });

  it("surfaces the server's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "sign in required" }), { status: 401 }))
    );
    const store = new HttpAnnotationStore("");
    await expect(store.remove("a1")).rejects.toThrow("Couldn't delete (401: sign in required)");
  });
});
