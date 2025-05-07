import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";

Rails.start();
window.bootstrap = bootstrap;

document.addEventListener("turbo:load", () => {
  console.log("✅ Avatar cropper JS is active");

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
    const transform = `translate(${startX}px, ${startY}px)`;
    cropImage.style.transform = transform;
    console.log(`🎯 画像 transform 更新: ${transform}`);
  }

  // 初期スタイル設定
  cropImage.style.position = "absolute";
  cropImage.style.top = "0";
  cropImage.style.left = "0";
  cropImage.style.userSelect = "none";
  cropImage.style.webkitUserSelect = "none"; // Safari用
  cropImage.style.maxWidth = "none";
  cropImage.style.maxHeight = "none";
  cropImage.draggable = false;

  cropContainer.style.cursor = "grab";
  cropContainer.style.touchAction = "none"; // これが超重要！

  // ファイルが選ばれた時の処理
  fileInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      cropImage.src = reader.result;
      console.log("🖼️ 画像読み込み成功");
      startX = 0;
      startY = 0;
      updateTransform();
      modal.show();
    };
    reader.readAsDataURL(file);
  });

  cropContainer.addEventListener("pointerdown", e => {
    console.log("👉 pointerdown", e.clientX, e.clientY);
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
    console.log("✋ pointermove →", { dx, dy, startX, startY });
    updateTransform();
  });

  cropContainer.addEventListener("pointerup", e => {
    console.log("🖐 pointerup");
    if (isDragging) {
      isDragging = false;
      cropContainer.releasePointerCapture(e.pointerId);
      cropContainer.style.cursor = "grab";
    }
  });

  confirmBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(cropImage, -startX, -startY);
    const dataUrl = canvas.toDataURL("image/png");

    console.log("✅ トリミング完了 → プレビューと hidden に反映");
    inlinePreview.src = dataUrl;
    hiddenField.value = dataUrl;
    modal.hide();
  });
});
