console.log("🔥 application.js 読み込み開始", Date.now());


import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";
import "./controllers";
import "./custom/comments";
import "./custom/flash_messages";
import "./custom/gages_test";

Rails.start();
window.bootstrap = bootstrap;

document.addEventListener("turbo:load", () => {
  const fileInput     = document.getElementById("avatarInput");
  const inlinePreview = document.getElementById("avatarPreviewInline");
  const modalEl       = document.getElementById("avatarCropModal");
  const cropContainer = document.getElementById("cropContainer");
  const cropImage     = document.getElementById("cropImage");
  const confirmBtn    = document.getElementById("cropConfirmBtn");
  const avatarUrlField = document.getElementById("avatarUrlField");

  if (![fileInput, inlinePreview, avatarUrlField, modalEl, cropContainer, cropImage, confirmBtn].every(Boolean)) {
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



 fileInput.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;

  // ファイル容量チェック（2MBまで）
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    alert("ファイルサイズは2MB以内にしてください。");
    fileInput.value = ""; // 選択をクリア
    return;
  }

  // MIMEタイプチェック（jpg/jpeg/pngのみ許可）
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowedTypes.includes(file.type)) {
    alert("ファイル形式はJPEGまたはPNGのみ許可されています。");
    fileInput.value = ""; // 選択をクリア
    return;
  }

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

  async function resizeImage(sourceImage, maxSize = 300) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const scale = Math.min(maxSize / sourceImage.width, maxSize / sourceImage.height);
      canvas.width = sourceImage.width * scale;
      canvas.height = sourceImage.height * scale;
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }

  // --- クロップ確定 ---
  confirmBtn.addEventListener("click", async () => {
    // 1. 80x80プレビュー
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    canvas.width  = 80;
    canvas.height = 80;

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
    inlinePreview.src = dataUrl;  // すぐ反映
    avatarUrlField.value = "";    // 一旦クリア

    modal.hide();

    // --- Cloudinaryへ裏でアップロード ---
    try {
      inlinePreview.classList.add("loading");

      const tempImage = new window.Image();
      tempImage.onload = async () => {
        const resizedBlob = await resizeImage(tempImage, 300);
        const fd = new FormData();
        fd.append("file", resizedBlob, "avatar.jpg");
        fd.append("upload_preset", window.CLOUDINARY_UPLOAD_PRESET);

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/upload`,
          fd
        );

        // 完了後：プレビューもhiddenもURLセット
        inlinePreview.src = res.data.secure_url;
        avatarUrlField.value = res.data.secure_url;
        inlinePreview.classList.remove("loading");
      };
      tempImage.src = dataUrl;

    } catch (err) {
      console.error("Cloudinary upload failed", err);
      inlinePreview.classList.remove("loading");
    }
  });
});

// 削除ボタンは今まで通り
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
