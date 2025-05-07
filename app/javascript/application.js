import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";

Rails.start();
window.bootstrap = bootstrap;

document.addEventListener("turbo:load", () => {
  const fileInput     = document.getElementById("avatarInput");
  const inlinePreview = document.getElementById("avatarPreviewInline");
  const hiddenField   = document.getElementById("croppedAvatarData");
  const modalEl       = document.getElementById("avatarCropModal");
  const cropContainer = document.getElementById("cropContainer");
  const cropImage     = document.getElementById("cropImage");
  const confirmBtn    = document.getElementById("cropConfirmBtn");

  if (![fileInput, inlinePreview, hiddenField, modalEl, cropContainer, cropImage, confirmBtn].every(Boolean)) {
    console.error("❌ 必要な要素が見つかりません");
    return;
  }

  const modal = new bootstrap.Modal(modalEl);
  let startX = 0, startY = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0;

  function updateTransform() {
    cropImage.style.transform = `translate(${startX}px, ${startY}px)`;
  }

  cropImage.style.position = "absolute";
  cropImage.style.top = "0";
  cropImage.style.left = "0";
  cropImage.style.userSelect = "none";
  cropImage.style.webkitUserSelect = "none";
  cropImage.style.maxWidth = "none";
  cropImage.style.maxHeight = "none";
  cropImage.draggable = false;
  cropContainer.style.cursor = "grab";
  cropContainer.style.touchAction = "none";

  fileInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      cropImage.src = reader.result;
      startX = 0;
      startY = 0;
      updateTransform();
      modal.show();
    };
    reader.readAsDataURL(file);
  });

  cropContainer.addEventListener("pointerdown", e => {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cropContainer.setPointerCapture(e.pointerId);
    cropContainer.style.cursor = "grabbing";
  });

  cropContainer.addEventListener("pointermove", e => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    startX += dx;
    startY += dy;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    updateTransform();
  });

  cropContainer.addEventListener("pointerup", e => {
    if (isDragging) {
      isDragging = false;
      cropContainer.releasePointerCapture(e.pointerId);
      cropContainer.style.cursor = "grab";
    }
  });

  confirmBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 80;
    canvas.height = 80;

    // cropContainer と cropImage のサイズ情報
    const viewWidth = cropContainer.clientWidth;
    const viewHeight = cropContainer.clientHeight;

    const scaleX = cropImage.naturalWidth / cropImage.clientWidth;
    const scaleY = cropImage.naturalHeight / cropImage.clientHeight;

    const sx = startX * -1 * scaleX;
    const sy = startY * -1 * scaleY;

    ctx.drawImage(
      cropImage,
      sx, sy,
      viewWidth * scaleX, viewHeight * scaleY,
      0, 0,
      canvas.width, canvas.height
    );

    const dataUrl = canvas.toDataURL("image/png");
    inlinePreview.src = dataUrl;
    hiddenField.value = dataUrl;
    modal.hide();
  });
});
