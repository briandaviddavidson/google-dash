declare module "csv2geojson" {
  export function csv2geojson(
    csv: string,
    cb: (err: unknown, data: GeoJSON.FeatureCollection) => void
  ): void;
}
