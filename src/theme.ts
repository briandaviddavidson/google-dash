// Light/dark theme toggle. Default follows the OS preference; an explicit choice
// is persisted. The initial theme is also applied by an inline script in
// index.html to avoid a flash of the wrong theme before this module runs.
const KEY = "gd-theme";

const MOON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;

export function initTheme() {
  const btn = document.getElementById("theme_toggle");
  apply(currentTheme());
  btn?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
  });
}

function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("theme_toggle");
  if (btn) {
    // Show the icon for the theme you'd switch TO.
    btn.innerHTML = theme === "dark" ? SUN : MOON;
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  }
}
