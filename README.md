# Google Dash

Google Dash is a situational-awareness dashboard generator on Google Cloud. It connects to your
data sources, lets you collaboratively annotate a Google Map, and shares that knowledge with
stakeholders. The flow: configure → load a basemap → search → drag-and-drop data → draw and
annotate → persist.

## Features

1. Google Maps base with a swappable basemap toggle (Streets / Light / Dark / Satellite)
2. Places search bar
3. Drag-and-drop data layers: `.geojson`, `.csv`, `.kml`, `.shp`
4. Annotation mode: draw points / lines / polygons, add metadata, persist them
5. Pluggable storage backend — Firestore, Cloud Storage, or in-memory (dev)

## Requirements

- Node v20+
- A **Google Maps JavaScript API key** with Maps JS, Places, and Drawing enabled
  ([get one](https://console.cloud.google.com/google/maps-apis)). Restrict it by HTTP referrer for
  your Hosting domain in production.
- A GCP project. For Firestore: a Firestore database. For Cloud Storage: a bucket.
- For deployment: the `firebase` CLI (bundled as a dev dependency) and `gcloud`.

## Getting started

```bash
git clone git@github.com:briandaviddavidson/google-dash.git
cd google-dash
npm ci
npm run config        # interactive setup wizard — writes .env
npm run dev           # Vite dev server (:1234) + API (:3000)
```

`npm run config` asks for your dashboard info, Google Maps API key, GCP project, and — the key
choice — **where annotations are stored: Firestore, Cloud Storage, or in-memory**. It writes a
single `.env` consumed by both the frontend (Vite `VITE_*` vars) and the server.

You can skip the wizard by copying `.env.example` to `.env` and filling it in by hand.

### Storage backends

| `STORAGE_BACKEND` | Behavior |
| --- | --- |
| `firestore` | One document per annotation feature in `FIRESTORE_COLLECTION`. Honors `FIRESTORE_EMULATOR_HOST` for local dev. |
| `gcs` | All annotations in a single GeoJSON object (`GCS_OBJECT`) in `GCS_BUCKET`; read-modify-write per change. |
| `memory` | Non-persistent, zero-setup local dev. |

Authentication uses [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
(`gcloud auth application-default login` locally; the Cloud Run service account in production).

## Project layout

```
src/        Frontend (Vite + TS): map.ts, layers.ts, annotations.ts, api.ts, index.html, styles.css
server/     API (Express): index.ts + storage/ adapters (firestore, gcs, memory) behind a factory
scripts/    config.ts — the npm run config wizard
data/       sample data.geojson for drag-and-drop testing
public/     static assets (logo, favicon)
```

The API exposes three routes: `POST /saveannotation`, `GET /getannotations`,
`POST /deleteannotation`, plus `GET /health`.

## Deployment

**Frontend → Firebase Hosting.** For production, set `VITE_API_BASE_URL=` (empty) so the app calls
the API same-origin via the Hosting rewrites in `firebase.json`:

```bash
npm run build
firebase deploy --only hosting
```

**API → Cloud Run.** Set the env vars (`STORAGE_BACKEND`, `GCP_PROJECT_ID`, and
`FIRESTORE_COLLECTION` or `GCS_BUCKET`) and grant the service account Firestore or Storage access:

```bash
gcloud run deploy google-dash-api --source . --region us-central1 \
  --set-env-vars STORAGE_BACKEND=firestore,GCP_PROJECT_ID=your-project,FIRESTORE_COLLECTION=annotations
```

`firebase.json` rewrites `/getannotations`, `/saveannotation`, `/deleteannotation`, and `/health`
to the `google-dash-api` Cloud Run service (update `serviceId`/`region` if you change them), so the
deployed frontend reaches the API with no CORS configuration.

## Built with

- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) — rendering, drawing, places, geometry
- [Firestore](https://cloud.google.com/firestore) / [Cloud Storage](https://cloud.google.com/storage) — annotation storage
- [Cloud Run](https://cloud.google.com/run) — API host
- [Firebase Hosting](https://firebase.google.com/docs/hosting) — static host
- [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/) — build
- [Express](https://expressjs.com/) — API server
- [csv2geojson](https://github.com/mapbox/csv2geojson), [@tmcw/togeojson](https://github.com/placemark/togeojson), [shapefile](https://github.com/mbostock/shapefile) — file conversion

## License

MIT
