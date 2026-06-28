import "dotenv/config";
import express from "express";
import cors from "cors";
import { createStore, type GeoJsonFeature } from "./storage/index.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const storePromise = createStore();

app.get("/health", (_req, res) => {
  res.json({ ok: true, backend: process.env.STORAGE_BACKEND || "firestore" });
});

// Upsert a single annotation feature.
app.post("/saveannotation", async (req, res) => {
  try {
    const feature = req.body as GeoJsonFeature;
    if (!feature || feature.id === undefined || feature.id === null) {
      return res.status(400).json({ error: "feature with an id is required" });
    }
    const store = await storePromise;
    await store.save(feature);
    res.json({ ok: true });
  } catch (err) {
    console.error("saveannotation failed", err);
    res.status(500).json({ error: "save failed" });
  }
});

// Return all annotations as a GeoJSON FeatureCollection.
app.get("/getannotations", async (_req, res) => {
  try {
    const store = await storePromise;
    const features = await store.getAll();
    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error("getannotations failed", err);
    res.status(500).json({ error: "read failed" });
  }
});

// Delete an annotation by id.
app.post("/deleteannotation", async (req, res) => {
  try {
    const id = req.body?.id;
    if (id === undefined || id === null) {
      return res.status(400).json({ error: "id is required" });
    }
    const store = await storePromise;
    await store.delete(String(id));
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteannotation failed", err);
    res.status(500).json({ error: "delete failed" });
  }
});

app.listen(port, () => {
  console.log(`google-dash API listening on port ${port}`);
});
