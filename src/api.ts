import type { Feature, FeatureCollection } from "./types";

// In prod the frontend calls /api/* same-origin (Firebase rewrite -> Cloud Run).
// In dev VITE_API_BASE_URL points straight at the local Express server.
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getAnnotations(): Promise<FeatureCollection> {
  const res = await fetch(`${BASE}/getannotations`);
  if (!res.ok) throw new Error(`getannotations: ${res.status}`);
  return res.json();
}

export async function saveAnnotation(feature: Feature): Promise<void> {
  const res = await fetch(`${BASE}/saveannotation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(feature),
  });
  if (!res.ok) throw new Error(`saveannotation: ${res.status}`);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/deleteannotation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`deleteannotation: ${res.status}`);
}
