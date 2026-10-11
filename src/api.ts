import type { Feature, FeatureCollection } from "./types";

// Where annotations live. "api" talks to the Express server (Firestore / Cloud
// Storage / memory behind it); "local" keeps them in this browser's
// localStorage, which is what the public demo uses so visitors can't change
// shared data.
export type StorageMode = "api" | "local";

export interface AnnotationStore {
  readonly mode: StorageMode;
  getAll(): Promise<FeatureCollection>;
  save(feature: Feature): Promise<void>;
  remove(id: string): Promise<void>;
}

export function storageMode(): StorageMode {
  return import.meta.env.VITE_STORAGE_MODE === "local" ? "local" : "api";
}

export function createAnnotationStore(token: () => Promise<string | null>): AnnotationStore {
  if (storageMode() === "local") return new LocalAnnotationStore(window.localStorage);
  return new HttpAnnotationStore(
    import.meta.env.VITE_API_BASE_URL ?? "",
    async (): Promise<Record<string, string>> => {
      const t = await token();
      return t ? { Authorization: `Bearer ${t}` } : {};
    }
  );
}

// In production the frontend calls the API same-origin (Firebase Hosting
// rewrites -> Cloud Run). In dev VITE_API_BASE_URL points straight at the local
// Express server.
export class HttpAnnotationStore implements AnnotationStore {
  readonly mode = "api" as const;

  constructor(
    private base: string,
    private headers: () => Promise<Record<string, string>> = async () => ({})
  ) {}

  async getAll(): Promise<FeatureCollection> {
    const res = await fetch(`${this.base}/getannotations`, { headers: await this.headers() });
    if (!res.ok) throw new Error(await errorMessage(res, "load annotations"));
    return res.json();
  }

  async save(feature: Feature): Promise<void> {
    const res = await fetch(`${this.base}/saveannotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await this.headers()) },
      body: JSON.stringify(feature),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "save"));
  }

  async remove(id: string): Promise<void> {
    const res = await fetch(`${this.base}/deleteannotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await this.headers()) },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "delete"));
  }
}

async function errorMessage(res: Response, action: string): Promise<string> {
  let detail = "";
  try {
    detail = ((await res.json()) as { error?: string }).error ?? "";
  } catch {
    // non-JSON body
  }
  return `Couldn't ${action} (${res.status}${detail ? `: ${detail}` : ""})`;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export class LocalAnnotationStore implements AnnotationStore {
  readonly mode = "local" as const;

  constructor(
    private storage: KeyValueStorage,
    private key = "gd-annotations"
  ) {}

  private read(): Feature[] {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.key) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(features: Feature[]) {
    this.storage.setItem(this.key, JSON.stringify(features));
  }

  async getAll(): Promise<FeatureCollection> {
    return { type: "FeatureCollection", features: this.read() };
  }

  async save(feature: Feature): Promise<void> {
    const features = this.read().filter((f) => String(f.id) !== String(feature.id));
    features.push(feature);
    this.write(features);
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((f) => String(f.id) !== id));
  }
}
