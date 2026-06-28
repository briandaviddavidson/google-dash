// Storage adapter contract. The config wizard picks Firestore or Cloud Storage
// at setup time; STORAGE_BACKEND selects the implementation here at runtime.

export interface GeoJsonFeature {
  type: "Feature";
  id?: string | number;
  geometry: unknown;
  properties: Record<string, unknown>;
}

export interface AnnotationStore {
  /** Upsert a single annotation feature (keyed by its id). */
  save(feature: GeoJsonFeature): Promise<void>;
  /** Return all stored annotation features. */
  getAll(): Promise<GeoJsonFeature[]>;
  /** Remove an annotation by id. */
  delete(id: string): Promise<void>;
}

export async function createStore(): Promise<AnnotationStore> {
  const backend = (process.env.STORAGE_BACKEND || "firestore").toLowerCase();
  switch (backend) {
    case "memory": {
      const { MemoryStore } = await import("./memory.js");
      return new MemoryStore();
    }
    case "gcs":
    case "storage":
    case "cloud-storage": {
      const { GcsStore } = await import("./gcs.js");
      return new GcsStore();
    }
    case "firestore":
    default: {
      const { FirestoreStore } = await import("./firestore.js");
      return new FirestoreStore();
    }
  }
}
