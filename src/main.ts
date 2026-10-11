import "./styles.css";
import { loadMap } from "./map";
import { initLayers } from "./layers";
import { initAnnotations } from "./annotations";
import { initTheme } from "./theme";
import { createAnnotationStore } from "./api";

async function main() {
  initTheme();

  let map: Awaited<ReturnType<typeof loadMap>>;
  try {
    map = await loadMap();
  } catch (err) {
    console.error(err);
    const el = document.getElementById("map");
    if (el) {
      el.innerHTML = `<div class="map-error">${(err as Error).message}</div>`;
    }
    return;
  }

  // The map is up; a failure in a sub-feature should not blank it.
  const store = createAnnotationStore();
  if (store.mode === "local") {
    document.getElementById("demo_note")?.classList.remove("hide");
  }
  try {
    initLayers(map);
    await initAnnotations(map, store);
  } catch (err) {
    console.error("feature init failed", err);
  }
}

main();
