// Minimal GeoJSON shapes shared across the frontend.
export interface Feature {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}
