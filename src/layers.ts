import { csv2geojson } from "csv2geojson";
import { kml } from "@tmcw/togeojson";
import * as shapefile from "shapefile";
import { showToast } from "./toast";

// Each dropped file becomes its own Data layer so it can be removed independently,
// mirroring the original layer-list behavior.
interface LoadedLayer {
  file: string;
  data: google.maps.Data;
}

const loaded: LoadedLayer[] = [];
let mapRef: google.maps.Map;

export function initLayers(map: google.maps.Map) {
  mapRef = map;
  const dndArea = document.getElementById("map")!;
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    dndArea.addEventListener("dragenter", () => dndArea.classList.add("drag"));
    dndArea.addEventListener("dragleave", () => dndArea.classList.remove("drag"));
    dndArea.addEventListener("dragover", preventDefault);
    dndArea.addEventListener("drop", (evt) => void droppedData(evt));
  }
}

function preventDefault(evt: Event) {
  evt.stopPropagation();
  evt.preventDefault();
}

const SUPPORTED = "Use .geojson, .json, .kml, .csv, or .shp (drop the matching .dbf too for attributes).";

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return (dot >= 0 ? name.slice(0, dot) : name).trim();
}

async function droppedData(evt: DragEvent) {
  evt.stopPropagation();
  evt.preventDefault();
  document.getElementById("map")!.classList.remove("drag");
  const files = Array.from(evt.dataTransfer?.files ?? []);

  // .dbf files carry shapefile attributes; pair them with their .shp by name.
  const dbfs = new Map<string, File>();
  for (const file of files) {
    if (extension(file.name) === "dbf") dbfs.set(baseName(file.name).toLowerCase(), file);
  }

  for (const file of files) {
    const name = baseName(file.name);
    try {
      switch (extension(file.name)) {
        case "geojson":
        case "json":
          loadGeojson(name, JSON.parse(await file.text()));
          break;
        case "csv":
          loadGeojson(name, await csvToGeojson(await file.text()));
          break;
        case "kml":
          loadGeojson(name, kml(new DOMParser().parseFromString(await file.text(), "text/xml")));
          break;
        case "shp": {
          const dbf = dbfs.get(name.toLowerCase());
          loadGeojson(name, await shpToGeojson(await file.arrayBuffer(), await dbf?.arrayBuffer()));
          break;
        }
        case "dbf":
          break; // handled with its .shp
        default:
          showToast(`${file.name}: unsupported file type. ${SUPPORTED}`, "error", 6000);
      }
    } catch (err) {
      console.error(`failed to load ${file.name}`, err);
      showToast(`Couldn't read ${file.name}: ${(err as Error).message}`, "error", 6000);
    }
  }
}

function csvToGeojson(csv: string): Promise<GeoJSON.FeatureCollection> {
  return new Promise((resolve, reject) => {
    csv2geojson(csv, (err, data) => {
      if (err) reject(new Error("no latitude/longitude columns found"));
      else resolve(data);
    });
  });
}

async function shpToGeojson(shp: ArrayBuffer, dbf?: ArrayBuffer) {
  const features: GeoJSON.Feature<GeoJSON.Geometry | null>[] = [];
  const source = await shapefile.open(shp, dbf);
  for (;;) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value);
  }
  return { type: "FeatureCollection" as const, features };
}

function loadGeojson(
  name: string,
  geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>
) {
  if (loaded.some((l) => l.file === name)) {
    showToast(`A layer named "${name}" is already on the map. Rename the file and try again.`, "error");
    return;
  }

  const color = getRandomColor();
  const data = new google.maps.Data({ map: mapRef });
  data.addGeoJson(geojson);
  data.setStyle((feature) => styleFor(feature, color));
  loaded.push({ file: name, data });
  addToLayerList(name);
}

function styleFor(
  feature: google.maps.Data.Feature,
  color: string
): google.maps.Data.StyleOptions {
  const type = feature.getGeometry()?.getType() ?? "";
  if (type.includes("Point")) {
    return {
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 1,
      },
    };
  }
  if (type.includes("LineString")) {
    return { strokeColor: color, strokeWeight: 2 };
  }
  return { fillColor: color, fillOpacity: 0.4, strokeColor: color, strokeWeight: 1 };
}

function addToLayerList(file: string) {
  const layersAdded = document.getElementById("layers_added")!;
  const layerList = document.getElementById("layer_list")!;
  layersAdded.classList.remove("hide");

  // Build with textContent: file names come from the user's disk.
  const li = document.createElement("li");
  const label = document.createElement("span");
  label.textContent = file;
  const remove = document.createElement("button");
  remove.className = "remove-btn";
  remove.textContent = "X";
  remove.setAttribute("aria-label", `Remove layer ${file}`);
  li.append(label, remove);
  layerList.appendChild(li);

  remove.addEventListener("click", () => {
    const idx = loaded.findIndex((l) => l.file === file);
    if (idx >= 0) {
      loaded[idx].data.setMap(null);
      loaded.splice(idx, 1);
    }
    li.remove();
    if (layerList.children.length === 0) {
      layersAdded.classList.add("hide");
    }
  });
}

function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
