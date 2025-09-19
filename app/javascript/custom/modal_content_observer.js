// app/javascript/custom/modal_content_observer.js
const modalContentObserver = new MutationObserver(() => {
  const modal = document.querySelector(".modal.show");
  const modalContent = document.querySelector(".modal-content");
  const loader = document.getElementById("loading-overlay");
  if (modal && modalContent && loader) {
    loader.classList.add("view-hidden");
    modalContentObserver.disconnect();
  }
});

modalContentObserver.observe(document.body, {
  childList: true,
  subtree: true,
});
