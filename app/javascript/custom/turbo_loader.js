// app/javascript/custom/turbo_loader.js
let __loaderTimer = null;
let __skipNextLoader = false;

function __showLoader() {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.remove("view-hidden");
}
function __hideLoader() {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.add("view-hidden");
}
function __scheduleLoader(delayMs = 250) {
  clearTimeout(__loaderTimer);
  __loaderTimer = setTimeout(() => {
    if (!__skipNextLoader) __showLoader();
    __skipNextLoader = false;
  }, delayMs);
}
function __cancelLoader() {
  clearTimeout(__loaderTimer);
  __loaderTimer = null;
  __hideLoader();
}

["click", "change", "submit"].forEach((t) => {
  document.addEventListener(
    t,
    (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-no-loader]") : null;
      if (el) __skipNextLoader = true;
    },
    true
  );
});

document.addEventListener("turbo:visit", (e) => {
  const nextUrl = e.detail?.url || "";
  if (nextUrl && nextUrl.split("#")[0] === location.href.split("#")[0]) {
    __skipNextLoader = true;
  }
  __scheduleLoader(250);
});

["turbo:before-render", "turbo:render", "turbo:load", "turbo:frame-load", "turbo:before-cache", "pageshow"]
  .forEach((evt) => document.addEventListener(evt, __cancelLoader, true));

document.addEventListener("turbo:load", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.classList.add("view-hidden");
});
