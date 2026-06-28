import { csv2geojson } from "csv2geojson";
import { kml } from "@tmcw/togeojson";
import * as shapefile from "shapefile";

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
    dndArea.addEventListener("drop", droppedData);
  }
}

function preventDefault(evt: Event) {
  evt.stopPropagation();
  evt.preventDefault();
}

function droppedData(evt: DragEvent) {
  evt.stopPropagation();
  evt.preventDefault();
  const files = evt.dataTransfer?.files;
  if (!files) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    const isBinary =
      file.name.indexOf(".shp") > 0 || file.name.indexOf(".zip") > 0;
    if (isBinary) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }

    reader.onload = (e) => {
      const result = e.target?.result;
      if (file.name.indexOf(".geojson") > 0) {
        loadGeojson(file.name, JSON.parse(result as string));
      } else if (file.name.indexOf(".csv") > 0) {
        loadCsv(file.name, result as string);
      } else if (file.name.indexOf(".kml") > 0) {
        loadKml(file.name, result as string);
      } else if (file.name.indexOf(".shp") > 0) {
        loadShp(file.name, result as ArrayBuffer);
      } else {
        alert(
          "That data type is not supported. Please use files ending in .geojson, .kml, .csv, or .shp"
        );
      }
    };
  }

  document.getElementById("map")!.classList.remove("drag");
}

function loadCsv(filename: string, csv: string) {
  csv2geojson(csv, (_err, data) => loadGeojson(filename, data));
}

function loadKml(filename: string, text: string) {
  const dom = new DOMParser().parseFromString(text, "text/xml");
  loadGeojson(filename, kml(dom));
}

async function loadShp(filename: string, buffer: ArrayBuffer) {
  const features: GeoJSON.Feature<GeoJSON.Geometry | null>[] = [];
  const source = await shapefile.open(buffer);
  for (;;) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value);
  }
  loadGeojson(filename, { type: "FeatureCollection", features });
}

function loadGeojson(
  filename: string,
  geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>
) {
  const file = filename.split(".")[0].replace(/\s/g, "");
  if (loaded.some((l) => l.file === file)) {
    alert("A layer with that name already exists. Please rename your file and try again.");
    return;
  }

  const color = getRandomColor();
  const data = new google.maps.Data({ map: mapRef });
  data.addGeoJson(geojson);
  data.setStyle((feature) => styleFor(feature, color));
  loaded.push({ file, data });
  addToLayerList(file);
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

  const li = document.createElement("li");
  li.id = `layer-${file}`;
  li.innerHTML = `<span>${file}</span><button class="remove-btn">X</button>`;
  layerList.appendChild(li);

  li.querySelector("button")!.addEventListener("click", () => {
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
