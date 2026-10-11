import "./styles.css";
import { loadMap } from "./map";
import { initLayers } from "./layers";
import { initAnnotations, reloadAnnotations, setCanEdit } from "./annotations";
import { initAuth } from "./auth";
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
  let ready = false;
  const auth = await initAuth((email) => {
    renderAuth(email);
    if (ready) {
      setCanEdit(email !== null, "Sign in to annotate");
      reloadAnnotations();
    }
  });
  const store = createAnnotationStore(() => auth.token());
  if (store.mode === "local") {
    document.getElementById("demo_note")?.classList.remove("hide");
  }
  if (auth.enabled) {
    document.getElementById("auth_section")?.classList.remove("hide");
    document.getElementById("auth_button")?.addEventListener("click", async () => {
      try {
        await ((await auth.token()) ? auth.signOut() : auth.signIn());
      } catch (err) {
        console.error("sign-in failed", err);
      }
    });
  }
  try {
    initLayers(map);
    await initAnnotations(map, store);
    if (auth.enabled) setCanEdit((await auth.token()) !== null, "Sign in to annotate");
    ready = true;
  } catch (err) {
    console.error("feature init failed", err);
  }
}

function renderAuth(email: string | null) {
  const status = document.getElementById("auth_status");
  const button = document.getElementById("auth_button");
  if (status) status.textContent = email ? `Signed in as ${email}` : "Sign in to add or edit annotations.";
  if (button) button.textContent = email ? "Sign out" : "Sign in with Google";
}

main();
