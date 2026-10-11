import type { GeoJsonFeature } from "./storage/index.js";

// Annotation ids become Firestore document ids, so keep them to a safe
// character set (no "/"); the frontend generates UUIDs.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const GEOMETRY_TYPES = new Set([
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
]);

export function isValidId(id: unknown): id is string | number {
  return (typeof id === "string" || typeof id === "number") && ID_PATTERN.test(String(id));
}

/** Returns an error message, or null if the body is an acceptable annotation. */
export function validateFeature(body: unknown): string | null {
  if (!body || typeof body !== "object") return "body must be a GeoJSON Feature";
  const f = body as Partial<GeoJsonFeature>;
  if (f.type !== "Feature") return 'type must be "Feature"';
  if (!isValidId(f.id)) return "id must be 1-128 letters, digits, _ or -";
  const geometry = f.geometry as { type?: unknown; coordinates?: unknown } | null | undefined;
  if (!geometry || typeof geometry !== "object" || !GEOMETRY_TYPES.has(String(geometry.type))) {
    return "geometry must be a GeoJSON geometry";
  }
  if (!Array.isArray(geometry.coordinates)) return "geometry.coordinates must be an array";
  if (f.properties !== undefined && (typeof f.properties !== "object" || Array.isArray(f.properties) || f.properties === null)) {
    return "properties must be an object";
  }
  return null;
}
