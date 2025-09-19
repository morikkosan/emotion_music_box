// app/javascript/custom/screen_cover.js
function hideScreenCover() {
  const cover = document.getElementById("screen-cover-loading");
  if (cover) {
    setTimeout(() => {
      cover.classList.add("hide");
      setTimeout(() => { cover.classList.add("view-hidden"); }, 200);
    }, 1200);
  }
}

window.addEventListener("DOMContentLoaded", hideScreenCover);
window.addEventListener("load", hideScreenCover);
document.addEventListener("turbo:load", hideScreenCover);
