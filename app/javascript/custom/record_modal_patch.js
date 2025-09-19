// app/javascript/custom/record_modal_patch.js
document.addEventListener("turbo:before-stream-render", (event) => {
  if (event.target.tagName !== "TURBO-STREAM") return;

  const action = event.target.getAttribute("action");
  const target = event.target.getAttribute("target");
  if (action !== "update" || target !== "record-modal-content") return;

  const original = event.detail.render;
  event.detail.render = (streamEl) => {
    original(streamEl);
    requestAnimationFrame(() => {
      const el = document.getElementById("record-modal");
      if (el && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(el).show();
      }
    });
  };
});
