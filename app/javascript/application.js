// app/javascript/application.js
import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";
import "./controllers";

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

  function updateTransform () {
    cropImage.style.transform = `translate(${startX}px, ${startY}px)`;
  }

  // --- 初期スタイル ---
  cropImage.style.position      = "absolute";
  cropImage.style.top           = "0";
  cropImage.style.left          = "0";
  cropImage.style.userSelect    = "none";
  cropImage.style.webkitUserSelect = "none";
  cropImage.style.maxWidth      = "none";
  cropImage.style.maxHeight     = "none";
  cropImage.draggable           = false;
  cropContainer.style.cursor    = "grab";
  cropContainer.style.touchAction = "none";

  // --- ファイル選択 ---
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

  // --- ドラッグ移動 ---
  cropContainer.addEventListener("pointerdown", e => {
    e.preventDefault();
    isDragging  = true;
    dragStartX  = e.clientX;
    dragStartY  = e.clientY;
    cropContainer.setPointerCapture(e.pointerId);
    cropContainer.style.cursor = "grabbing";
  });

  cropContainer.addEventListener("pointermove", e => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    startX  += dx;
    startY  += dy;
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

  // --- クロップ確定 ---
  confirmBtn.addEventListener("click", async () => {
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    canvas.width  = 80;
    canvas.height = 80;

    // 表示領域と画像のスケール
    const viewWidth  = cropContainer.clientWidth;
    const viewHeight = cropContainer.clientHeight;
    const scaleX = cropImage.naturalWidth  / cropImage.clientWidth;
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

    // ===== Cloudinary へアップロード（既存処理は変更せず追加のみ） =====
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fd   = new FormData();
      fd.append("file", blob, "avatar.png");
      fd.append("upload_preset", window.CLOUDINARY_UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/upload`,
        fd // ← FormData
        // 👇この headers 行は削除！
        // { headers: { "Content-Type": "multipart/form-data" } }
      );

      inlinePreview.src = res.data.secure_url;
      hiddenField.value = res.data.secure_url;
    } catch (err) {
      console.error("Cloudinary upload failed", err);
    } finally {
      modal.hide();
    }
    // ======================================================================
  });
});

document.addEventListener("turbo:load", () => {
  const removeAvatarBtn = document.getElementById("removeAvatarBtn");
  const removeAvatarCheckbox = document.getElementById("removeAvatarCheckbox");

  if (removeAvatarBtn && removeAvatarCheckbox) {
    removeAvatarBtn.addEventListener("click", () => {
      const isChecked = removeAvatarCheckbox.checked;
      const confirmMsg = isChecked ? "削除をキャンセルしますか？" : "本当に画像を削除しますか？";

      if (confirm(confirmMsg)) {
        removeAvatarCheckbox.checked = !isChecked;

        if (removeAvatarCheckbox.checked) {
          removeAvatarBtn.textContent = "削除予定";
          removeAvatarBtn.classList.remove("btn-warning");
          removeAvatarBtn.classList.add("btn-danger");
        } else {
          removeAvatarBtn.textContent = "画像を削除する";
          removeAvatarBtn.classList.remove("btn-danger");
          removeAvatarBtn.classList.add("btn-warning");
        }
      }
    });
  }
});
