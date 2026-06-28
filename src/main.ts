import "./styles.css";
import { loadMap } from "./map";
import { initLayers } from "./layers";
import { initAnnotations } from "./annotations";
import { initTheme } from "./theme";

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
  try {
    initLayers(map);
    await initAnnotations(map);
  } catch (err) {
    console.error("feature init failed", err);
  }
}

main();
