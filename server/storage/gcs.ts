import { Storage } from "@google-cloud/storage";
import type { AnnotationStore, GeoJsonFeature } from "./index.js";

interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

// All annotations live in a single GeoJSON object in a bucket. Each mutation is a
// read-modify-write of the whole FeatureCollection. Simpler/cheaper than Firestore,
// but no per-feature querying.
export class GcsStore implements AnnotationStore {
  private storage: Storage;
  private bucket: string;
  private object: string;

  constructor() {
    this.storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
    const bucket = process.env.GCS_BUCKET;
    if (!bucket) {
      throw new Error("GCS_BUCKET is required when STORAGE_BACKEND=gcs");
    }
    this.bucket = bucket;
    this.object = process.env.GCS_OBJECT || "annotations.geojson";
  }

  private file() {
    return this.storage.bucket(this.bucket).file(this.object);
  }

  private async read(): Promise<FeatureCollection> {
    const file = this.file();
    const [exists] = await file.exists();
    if (!exists) {
      return { type: "FeatureCollection", features: [] };
    }
    const [contents] = await file.download();
    return JSON.parse(contents.toString("utf8")) as FeatureCollection;
  }

  private async write(fc: FeatureCollection): Promise<void> {
    await this.file().save(JSON.stringify(fc), {
      contentType: "application/geo+json",
    });
  }

  async save(feature: GeoJsonFeature): Promise<void> {
    const fc = await this.read();
    const idx = fc.features.findIndex((f) => String(f.id) === String(feature.id));
    if (idx >= 0) {
      fc.features[idx] = feature;
    } else {
      fc.features.push(feature);
    }
    await this.write(fc);
  }

  async getAll(): Promise<GeoJsonFeature[]> {
    const fc = await this.read();
    return fc.features;
  }

  async delete(id: string): Promise<void> {
    const fc = await this.read();
    fc.features = fc.features.filter((f) => String(f.id) !== String(id));
    await this.write(fc);
  }
}
