import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";
import "./controllers";
import "./custom/comments";
import "./custom/flash_messages";
import "./custom/gages_test";
import "./custom/inline_handlers";
import "./custom/swal_my_create";
import { subscribeToPushNotifications } from "./custom/push_subscription";

Rails.start();
console.log("🔥 Rails UJS is loaded!", Rails);

window.bootstrap = bootstrap;


/** ▼▼▼ ここから保険 ▼▼▼ **/
function hideMobileSearchModalSafely() {
  const el = document.getElementById("mobile-super-search-modal");
  const BS = window.bootstrap && window.bootstrap.Modal;
  if (!el || !BS) return;

  // 既存 or 新規インスタンスを必ず取る（消えた参照を使わない）
  const inst = BS.getInstance(el) || BS.getOrCreateInstance(el, { backdrop: true, keyboard: true });

  // Bootstrapの正式APIで閉じる → 念のため残骸も掃除
  try { inst.hide(); } catch {}

  // 念のための残骸掃除（重複removeでも安全）
  document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");

  // element 側の visible 状態も確実に戻す
  el.classList.remove("show");
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
}

// Turbo の画面差し替え前／キャッシュ前／訪問開始で毎回閉じる
document.addEventListener("turbo:before-render", hideMobileSearchModalSafely);
document.addEventListener("turbo:before-cache",  hideMobileSearchModalSafely);
document.addEventListener("turbo:visit",         hideMobileSearchModalSafely);

// bfcache 復帰（戻る）でも念のため閉じる
window.addEventListener("pageshow", (e) => {
  if (e.persisted) hideMobileSearchModalSafely();
});


// サービスワーカー登録
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

// Turboローディング制御まとめ
document.addEventListener("turbo:visit", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.classList.remove("view-hidden"); // 表示
});

document.addEventListener("turbo:load", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.classList.add("view-hidden"); // 非表示

  // Push通知
  subscribeToPushNotifications().catch(err => {
    console.error("Push通知登録エラー:", err);
  });

  // HPと日付保存
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem("hpDate");

  if (savedDate !== today) {
    localStorage.setItem("hpPercentage", "50");
    localStorage.setItem("hpDate", today);
  }

  // Turboフレーム内でローディングを非表示
  document.addEventListener("turbo:frame-load", () => {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.add("view-hidden");
  });

  // Turboフレーム内モーダルにも対応
  const modalFixObserver = new MutationObserver(() => {
    const modal = document.querySelector(".modal.show");
    const modalContent = document.querySelector(".modal-content");
    const loader = document.getElementById("loading-overlay");
    // 「style.display」直接比較はやめてOK、常に非表示指示でOK
    if (modal && modalContent && loader) {
      loader.classList.add("view-hidden");
    }
  });

  modalFixObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // おすすめボタン
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

  // アバター画像アップロード（Cropper）
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

// モーダルの中身が追加されたことを監視してローディングを強制的に非表示
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

// グローバル関数として定義
window.goToRecommended = function () {
  const storedHP = localStorage.getItem("hpPercentage");
  const hp = parseInt(storedHP);
  if (!isNaN(hp)) {
    window.location.href = `/emotion_logs/recommended?hp=${hp}`;
  } else {
    alert("HPゲージの値が取得できませんでした（localStorageに保存されていません）");
  }
};

// ローディングカバーを隠す（CSP対応）
function hideScreenCover() {
  var cover = document.getElementById("screen-cover-loading");
  if (cover) {
    setTimeout(() => {
      cover.classList.add("hide");
      setTimeout(() => { cover.classList.add("view-hidden"); }, 200); // ← 最後にclassで消す
    }, 1200); // ここは好きな秒数でOK
  }
}


// スマホ版プレイリストモーダル
document.addEventListener("DOMContentLoaded", function() {
  var btn = document.getElementById("show-playlist-modal-mobile");
  if (!btn) return;
  btn.addEventListener("click", function(e) {
    e.preventDefault();

    var modal = document.getElementById("playlist-modal-mobile");
    var content = document.getElementById("playlist-modal-content-mobile");
    if (!modal || !content) return;

    // ajaxで部分テンプレートを取得
    fetch('/emotion_logs/playlist_sidebar_modal', {
      headers: { 'Accept': 'text/html' }
    })
      .then(response => response.text())
      .then(html => {
        content.innerHTML = html;
        modal.style.display = "block";
        // 背景クリックで閉じる
        modal.onclick = function(ev) {
          if (ev.target === modal) modal.style.display = "none";
        }
      });
  });
});



window.addEventListener("DOMContentLoaded", hideScreenCover);
window.addEventListener("load", hideScreenCover);
document.addEventListener("turbo:load", hideScreenCover);
