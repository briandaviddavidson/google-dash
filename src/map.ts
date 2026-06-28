import { Loader } from "@googlemaps/js-api-loader";

// Light/dark basemaps are styled overlays on the roadmap base. Streets -> roadmap,
// Satellite -> hybrid use Google's built-in map types.
const LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e6f2" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
];

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
];

export async function loadMap(): Promise<google.maps.Map> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_GOOGLE_MAPS_API_KEY is not set. Run `npm run config` or copy .env.example to .env."
    );
  }

  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: ["places", "geometry"],
  });
  await loader.load();

  const map = new google.maps.Map(document.getElementById("map")!, {
    center: { lat: 38.67, lng: -104.37 },
    zoom: 4,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    clickableIcons: false,
  });

  // Register styled basemaps.
  map.mapTypes.set("light", new google.maps.StyledMapType(LIGHT_STYLE, { name: "Light" }));
  map.mapTypes.set("dark", new google.maps.StyledMapType(DARK_STYLE, { name: "Dark" }));

  setupBasemapToggle(map);
  setupSearch(map);

  return map;
}

function setupBasemapToggle(map: google.maps.Map) {
  const toggle = document.getElementById("basemap-toggle");
  if (!toggle) return;
  const buttons = Array.from(toggle.getElementsByTagName("button"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      map.setMapTypeId(button.id as google.maps.MapTypeId);
    });
  }
}

async function setupSearch(map: google.maps.Map) {
  const container = document.getElementById("search_container");
  if (!container) return;

  // Autocomplete is closed to new API customers; use the modern element instead.
  const { PlaceAutocompleteElement } = (await google.maps.importLibrary(
    "places"
  )) as google.maps.PlacesLibrary;
  const element = new PlaceAutocompleteElement({});
  element.id = "search";
  container.appendChild(element);

  element.addEventListener("gmp-select", async (event: Event) => {
    const { placePrediction } = event as unknown as {
      placePrediction: google.maps.places.PlacePrediction;
    };
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ["location", "viewport"] });
    if (place.viewport) {
      map.fitBounds(place.viewport);
    } else if (place.location) {
      map.setCenter(place.location);
      map.setZoom(12);
    }
  });
}
