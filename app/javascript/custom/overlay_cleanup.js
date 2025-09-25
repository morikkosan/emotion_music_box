// app/javascript/custom/overlay_cleanup.js
export function runGlobalOverlayCleanup() {
  // Modals を強制クローズ＋破棄
  document.querySelectorAll(".modal.show").forEach(m => {
    try {
      const inst = (window.bootstrap?.Modal.getInstance(m)) || (window.bootstrap?.Modal.getOrCreateInstance(m));
      inst.hide(); inst.dispose();
    } catch (_) {}
    m.classList.remove("show");
    m.style.display = "";
    m.removeAttribute("aria-modal");
    m.setAttribute("aria-hidden", "true");
  });

  // Backdrop / offcanvas
  document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(el => el.remove());

  // <body> の状態を正常化
  document.body.classList.remove("modal-open", "swal2-shown");
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  document.body.style.pointerEvents = "auto";

  // SweetAlertなどの残骸も掃除
  ["#swal-fake-modal",".sweet-overlay","#sweet-alert",".swal2-container",".swal2-backdrop"].forEach(sel => {
    document.querySelectorAll(sel).forEach(n => {
      try { n.remove(); } catch (_) {
        n.style.pointerEvents = "none";
        n.style.display = "none";
        n.style.visibility = "hidden";
      }
    });
  });
}
