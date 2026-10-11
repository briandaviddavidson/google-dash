// Small status messages in the corner of the map, used instead of alert() and
// for save/delete/load failures that used to go only to the console.
let container: HTMLElement | null = null;

export function showToast(message: string, kind: "info" | "error" = "info", ms = 4000) {
  if (!container) {
    container = document.createElement("div");
    container.className = "toasts";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${kind}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), ms);
}
