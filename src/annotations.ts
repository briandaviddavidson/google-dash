import { getAnnotations, saveAnnotation, deleteAnnotation } from "./api";
import type { Feature } from "./types";

type Mode = "map" | "annotate";
type DrawMode = "none" | "point" | "line" | "polygon";

// google.maps.drawing.DrawingManager was removed from the Maps JS API in v3.65,
// so annotations are drawn directly: click to drop vertices on the Data layer.
let map: google.maps.Map;
let annotations: google.maps.Data;
let infoWindow: google.maps.InfoWindow;

let mode: Mode = "map";
let drawMode: DrawMode = "none";
let selectedId: string | null = null;

let drawId = "";
let tempVertices: google.maps.LatLng[] = [];
let tempFeature: google.maps.Data.Feature | null = null;

// Panel + control elements
let panel: HTMLElement;
let banner: HTMLElement;
let onOff: HTMLElement;
let toolbar: HTMLElement;
let idInput: HTMLInputElement;
let nameInput: HTMLInputElement;
let descInput: HTMLTextAreaElement;
let notesInput: HTMLTextAreaElement;
let measure: HTMLElement;

export async function initAnnotations(theMap: google.maps.Map) {
  map = theMap;
  panel = document.getElementById("annotation_panel")!;
  banner = document.getElementById("annotation_banner")!;
  onOff = document.getElementById("annotation_onoff")!;
  toolbar = document.getElementById("draw_toolbar")!;
  idInput = document.getElementById("annotation_id") as HTMLInputElement;
  nameInput = document.getElementById("annotation_name") as HTMLInputElement;
  descInput = document.getElementById("annotation_desc") as HTMLTextAreaElement;
  notesInput = document.getElementById("annotation_notes") as HTMLTextAreaElement;
  measure = document.getElementById("annotation_measure")!;

  infoWindow = new google.maps.InfoWindow();
  annotations = new google.maps.Data({ map });
  annotations.setStyle(() => annotationStyle());

  map.addListener("click", (e: google.maps.MapMouseEvent) => {
    if (e.latLng) handleDrawClick(e.latLng);
  });

  annotations.addListener("click", (e: google.maps.Data.MouseEvent) => {
    if (drawMode !== "none") {
      if (e.latLng) handleDrawClick(e.latLng);
    } else if (mode === "annotate") {
      selectFeature(e.feature);
    } else {
      openInfo(e.feature, e.latLng!);
    }
  });

  document.getElementById("draw_point")!.addEventListener("click", () => startDraw("point"));
  document.getElementById("draw_line")!.addEventListener("click", () => startDraw("line"));
  document.getElementById("draw_polygon")!.addEventListener("click", () => startDraw("polygon"));
  document.getElementById("draw_finish")!.addEventListener("click", finishDraw);
  document.getElementById("annotation_toggle")!.addEventListener("click", toggleMode);
  document.getElementById("annotation_save")!.addEventListener("click", onSave);
  document.getElementById("annotation_delete")!.addEventListener("click", onDelete);

  await loadSaved();
}

function annotationStyle(): google.maps.Data.StyleOptions {
  const editable = mode === "annotate" && drawMode === "none";
  return {
    editable,
    draggable: editable,
    fillColor: "#fbb03b",
    fillOpacity: 0.25,
    strokeColor: "#62b5b5",
    strokeWeight: 2,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#fbb03b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  };
}

async function loadSaved() {
  try {
    const fc = await getAnnotations();
    annotations.addGeoJson(fc);
  } catch (err) {
    console.error("failed to load annotations", err);
  }
}

// --- Drawing ---

function startDraw(m: DrawMode) {
  cancelTemp();
  drawMode = m;
  drawId = crypto.randomUUID();
  tempVertices = [];
  tempFeature = null;
  refreshStyle();
  updateToolbar();
}

function handleDrawClick(latLng: google.maps.LatLng) {
  if (mode !== "annotate" || drawMode === "none") return;

  if (drawMode === "point") {
    const feature = new google.maps.Data.Feature({
      id: crypto.randomUUID(),
      geometry: new google.maps.Data.Point(latLng),
    });
    annotations.add(feature);
    resetDraw();
    selectFeature(feature);
    return;
  }

  tempVertices.push(latLng);
  const geometry = new google.maps.Data.LineString(tempVertices);
  if (!tempFeature) {
    tempFeature = new google.maps.Data.Feature({ id: drawId, geometry });
    annotations.add(tempFeature);
  } else {
    tempFeature.setGeometry(geometry);
  }
}

function finishDraw() {
  if (!tempFeature) {
    resetDraw();
    return;
  }
  if (drawMode === "line" && tempVertices.length >= 2) {
    const feature = tempFeature;
    resetDraw();
    selectFeature(feature);
  } else if (drawMode === "polygon" && tempVertices.length >= 3) {
    tempFeature.setGeometry(new google.maps.Data.Polygon([tempVertices]));
    const feature = tempFeature;
    resetDraw();
    selectFeature(feature);
  } else {
    cancelTemp();
    resetDraw();
  }
}

function cancelTemp() {
  if (tempFeature) {
    annotations.remove(tempFeature);
    tempFeature = null;
  }
}

function resetDraw() {
  drawMode = "none";
  tempVertices = [];
  tempFeature = null;
  refreshStyle();
  updateToolbar();
}

function updateToolbar() {
  toolbar
    .querySelectorAll("button")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === drawMode));
}

function refreshStyle() {
  annotations.setStyle(() => annotationStyle());
}

// --- Selection + persistence ---

function selectFeature(feature: google.maps.Data.Feature) {
  selectedId = String(feature.getId());
  panel.classList.remove("hide");
  idInput.value = selectedId;
  nameInput.value = (feature.getProperty("name") as string) ?? "";
  descInput.value = (feature.getProperty("description") as string) ?? "";
  notesInput.value = (feature.getProperty("notes") as string) ?? "";
  measure.textContent = measurementFor(feature);
}

function measurementFor(feature: google.maps.Data.Feature): string {
  const geom = feature.getGeometry();
  if (!geom) return "";
  const type = geom.getType();
  if (type === "Polygon") {
    const ring = (geom as google.maps.Data.Polygon).getArray()[0].getArray();
    const sqm = google.maps.geometry.spherical.computeArea(ring);
    return `Area: ${(sqm / 1_000_000).toFixed(3)} km²`;
  }
  if (type === "LineString") {
    const pts = (geom as google.maps.Data.LineString).getArray();
    const m = google.maps.geometry.spherical.computeLength(pts);
    return `Length: ${(m / 1000).toFixed(3)} km`;
  }
  return "";
}

function findSelected(): google.maps.Data.Feature | null {
  return selectedId ? annotations.getFeatureById(selectedId) ?? null : null;
}

async function onSave(e: Event) {
  e.preventDefault();
  const feature = findSelected();
  if (!feature) return;
  feature.setProperty("name", nameInput.value);
  feature.setProperty("description", descInput.value);
  feature.setProperty("notes", notesInput.value);

  const spinner = document.getElementById("annotation_spinner")!;
  spinner.classList.remove("hide");
  try {
    await saveAnnotation(await featureToGeoJson(feature));
  } catch (err) {
    console.error("save failed", err);
  } finally {
    spinner.classList.add("hide");
  }
}

async function onDelete() {
  const feature = findSelected();
  if (!feature) return;
  annotations.remove(feature);
  panel.classList.add("hide");
  try {
    await deleteAnnotation(selectedId!);
  } catch (err) {
    console.error("delete failed", err);
  }
  selectedId = null;
}

// Export a single Data.Feature to a GeoJSON Feature via the layer exporter.
function featureToGeoJson(feature: google.maps.Data.Feature): Promise<Feature> {
  return new Promise((resolve) => {
    annotations.toGeoJson((obj) => {
      const fc = obj as GeoJSON.FeatureCollection;
      const id = String(feature.getId());
      const match = fc.features.find((f) => String(f.id) === id);
      resolve(match as unknown as Feature);
    });
  });
}

function openInfo(feature: google.maps.Data.Feature, latLng: google.maps.LatLng) {
  const name = (feature.getProperty("name") as string) ?? "";
  const description = (feature.getProperty("description") as string) ?? "";
  const notes = (feature.getProperty("notes") as string) ?? "";
  infoWindow.setContent(
    `<ul class="info">
       <li><strong>Name:</strong> ${escapeHtml(name)}</li>
       <li><strong>Description:</strong> ${escapeHtml(description)}</li>
       <li><strong>Notes:</strong> ${escapeHtml(notes)}</li>
     </ul>`
  );
  infoWindow.setPosition(latLng);
  infoWindow.open(map);
}

function toggleMode() {
  if (mode === "map") {
    mode = "annotate";
    onOff.textContent = "Off";
    banner.classList.remove("hide");
    toolbar.classList.remove("hide");
  } else {
    mode = "map";
    onOff.textContent = "On";
    banner.classList.add("hide");
    toolbar.classList.add("hide");
    panel.classList.add("hide");
    cancelTemp();
    resetDraw();
  }
  refreshStyle();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
