import type { AnnotationStore, GeoJsonFeature } from "./index.js";

// Zero-setup, non-persistent store for local dev and testing (no GCP creds needed).
// Selected with STORAGE_BACKEND=memory.
export class MemoryStore implements AnnotationStore {
  private features = new Map<string, GeoJsonFeature>();

  async save(feature: GeoJsonFeature): Promise<void> {
    this.features.set(String(feature.id), feature);
  }

  async getAll(): Promise<GeoJsonFeature[]> {
    return [...this.features.values()];
  }

  async delete(id: string): Promise<void> {
    this.features.delete(String(id));
  }
}
