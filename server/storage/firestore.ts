import { Firestore } from "@google-cloud/firestore";
import type { AnnotationStore, GeoJsonFeature } from "./index.js";

// One document per annotation feature, keyed by the feature id. Natural fit for
// the save/get/delete CRUD shape. Honors FIRESTORE_EMULATOR_HOST for local dev.
export class FirestoreStore implements AnnotationStore {
  private db: Firestore;
  private collection: string;

  constructor() {
    this.db = new Firestore({
      projectId: process.env.GCP_PROJECT_ID,
    });
    this.collection = process.env.FIRESTORE_COLLECTION || "annotations";
  }

  async save(feature: GeoJsonFeature): Promise<void> {
    const id = String(feature.id);
    await this.db
      .collection(this.collection)
      .doc(id)
      .set({ feature, dateUpdated: new Date().toISOString() });
  }

  async getAll(): Promise<GeoJsonFeature[]> {
    const snapshot = await this.db.collection(this.collection).get();
    return snapshot.docs.map((doc) => doc.data().feature as GeoJsonFeature);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(String(id)).delete();
  }
}
