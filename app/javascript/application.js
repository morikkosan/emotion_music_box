import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";
import "./controllers";
import "./custom/comments";
import "./custom/flash_messages";
import "./custom/gages_test";
import "./custom/inline_handlers";
import "./custom/swal_my_create";
import { subscribeToPushNotifications } from "./custom/push_subscription";  // ← ここを修正

//console.log("🔥 application.js 読み込み開始", Date.now());

Rails.start();
console.log("🔥 Rails UJS is loaded!", Rails);

window.bootstrap = bootstrap;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('ServiceWorker 登録成功:', reg))
    .catch(err => console.error('ServiceWorker 登録失敗:', err));
}

// 重複する関数はここに書かない！！！

// ログインしているユーザーだけ実行
document.addEventListener('DOMContentLoaded', () => {
  if (window.isLoggedIn) {
    subscribeToPushNotifications();
  }
});

// ✅ Turboローディング制御まとめ
document.addEventListener("turbo:visit", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.style.display = "flex";
});

document.addEventListener("turbo:load", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.style.display = "none";
  // 非同期関数はここで呼び出す（awaitは使えないので then か IIFEで処理）
  subscribeToPushNotifications().catch(err => {
    console.error("Push通知登録エラー:", err);
  });

  // 🌱 初期HPと日付の保存処理（ここに移動して確実にDOM読み込み後に実行）
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem("hpDate");

  if (savedDate !== today) {
    localStorage.setItem("hpPercentage", "50");
    localStorage.setItem("hpDate", today);
    //console.log("✅ HPと日付を初期化しました:", today);
  } else {
    //console.log("✅ 既に保存されたHPを使用中:", localStorage.getItem("hpPercentage"));
  }

  //ローディングを非表示にする
document.addEventListener("turbo:frame-load", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) {
    //console.log("🟢 turbo:frame-load → ローディング非表示");
    loader.style.display = "none";
  }
});
  // ✅ Turboフレーム内にモーダルが差し込まれた時にもローディングを確実に消す2回目
const modalFixObserver = new MutationObserver(() => {
  const modal = document.querySelector(".modal.show");
  const modalContent = document.querySelector(".modal-content");
  const loader = document.getElementById("loading-overlay");

  if (modal && modalContent && loader && loader.style.display !== "none") {
    //console.log("🛠 turbo-frame + modal を検出 → ローディング非表示");
    loader.style.display = "none";
  }
});

modalFixObserver.observe(document.body, {
  childList: true,
  subtree: true,
});


  // 🔽 「おすすめ」ボタン処理
    const recommendButton = document.getElementById("show-recommendations-btn");
  if (recommendButton) {
    recommendButton.addEventListener("click", () => {
      const storedHP = localStorage.getItem("hpPercentage");
      const hp = parseInt(storedHP);
      if (!isNaN(hp)) {
        window.location.href = `/emotion_logs?hp=${hp}`;
      } else {
        alert("HPゲージの値が取得できませんでした（localStorageに保存されていません）");
      }
    });
  }

  // 🔽 アバター画像のアップロード処理（Cropper）
  const fileInput = document.getElementById("avatarInput");
  const inlinePreview = document.getElementById("avatarPreviewInline");
  const modalEl = document.getElementById("avatarCropModal");
  const cropContainer = document.getElementById("cropContainer");
  const cropImage = document.getElementById("cropImage");
  const confirmBtn = document.getElementById("cropConfirmBtn");
  const avatarUrlField = document.getElementById("avatarUrlField");
  const submitBtn = document.querySelector('form input[type="submit"]');

  if (![fileInput, inlinePreview, avatarUrlField, modalEl, cropContainer, cropImage, confirmBtn].every(Boolean)) {
    console.warn("⚠️ アバター関連の要素が見つかりません（このページでは不要の可能性あり）");
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

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("ファイルサイズは2MB以内にしてください。");
      fileInput.value = "";
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      alert("ファイル形式はJPEGまたはPNGのみ許可されています。");
      fileInput.value = "";
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

  async function resizeImage(sourceImage, maxSize = 300) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const scale = Math.min(maxSize / sourceImage.width, maxSize / sourceImage.height);
      canvas.width = sourceImage.width * scale;
      canvas.height = sourceImage.height * scale;
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }

  confirmBtn.addEventListener("click", async () => {
  if (submitBtn) submitBtn.disabled = true;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 80;
  canvas.height = 80;

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
  avatarUrlField.value = "";
  modal.hide();

  // ここでCloudinary設定の有無を判定
  if (window.CLOUDINARY_CLOUD_NAME && window.CLOUDINARY_UPLOAD_PRESET) {
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

        inlinePreview.src = res.data.secure_url;
        avatarUrlField.value = res.data.secure_url;
        if (submitBtn) submitBtn.disabled = false;
        inlinePreview.classList.remove("loading");
      };
      tempImage.src = dataUrl;
    } catch (err) {
      console.error("Cloudinary upload failed", err);
      inlinePreview.classList.remove("loading");
      if (submitBtn) submitBtn.disabled = false;
    }
  } else {
    // ←開発時はこちら！アップロードせずcanvasのデータURLだけでOK
    avatarUrlField.value = dataUrl;
    if (submitBtn) submitBtn.disabled = false;
  }
});

  const removeAvatarBtn = document.getElementById("removeAvatarBtn");
  const removeAvatarCheckbox = document.getElementById("removeAvatarCheckbox");

  if (removeAvatarBtn && removeAvatarCheckbox) {
    removeAvatarBtn.addEventListener("click", () => {
      const isChecked = removeAvatarCheckbox.checked;
      const confirmMsg = isChecked ? "削除をキャンセルしますか？" : "本当に画像を削除しますか？";

      if (confirm(confirmMsg)) {
        removeAvatarCheckbox.checked = !isChecked;
        removeAvatarBtn.textContent = removeAvatarCheckbox.checked ? "削除予定" : "画像を削除する";
        removeAvatarBtn.classList.toggle("btn-danger", removeAvatarCheckbox.checked);
        removeAvatarBtn.classList.toggle("btn-warning", !removeAvatarCheckbox.checked);
      }
    });
  }

  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      if (!avatarUrlField.value && !removeAvatarCheckbox?.checked) {
        e.preventDefault();
        alert("画像のアップロードがまだ完了していません！");
      }
    });
  }
});
// ✅ モーダルの中身が追加されたことを監視してローディングを強制的に非表示
const modalContentObserver = new MutationObserver(() => {
  const modal = document.querySelector(".modal.show");
  const modalContent = document.querySelector(".modal-content");
  const loader = document.getElementById("loading-overlay");

  if (modal && modalContent && loader && loader.style.display !== "none") {
    //console.log("✅ モーダルと中身を検出 → ローディングを非表示にします");
    loader.style.display = "none";
    modalContentObserver.disconnect();
  }
});

modalContentObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

// ✅ グローバル関数として定義することで onclick="goToRecommended()" が動くようにする
window.goToRecommended = function () {
  const storedHP = localStorage.getItem("hpPercentage");
  const hp = parseInt(storedHP);

  //console.log("🔥 goToRecommended 実行: HP =", hp);

  if (!isNaN(hp)) {
    window.location.href = `/emotion_logs/recommended?hp=${hp}`;
  } else {
    alert("HPゲージの値が取得できませんでした（localStorageに保存されていません）");
  }
};


function hideScreenCover() {
  var cover = document.getElementById("screen-cover-loading");
  if (cover) {
    // ★ ここで数秒だけローディングを"意図的に"残す
    setTimeout(() => {
      cover.classList.add("hide");
      setTimeout(() => { cover.style.display = "none"; }, 200); // ← フェードアウト
    }); // ← ここを好きなだけ遅らせる（例: 1200ミリ秒 = 1.2秒）
  }
}
window.addEventListener("DOMContentLoaded", hideScreenCover);
window.addEventListener("load", hideScreenCover);
document.addEventListener("turbo:load", hideScreenCover);
