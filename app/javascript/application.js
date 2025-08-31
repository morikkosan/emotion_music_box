// app/javascript/application.js
import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";
import "./controllers";
import "./custom/comments";
import "./custom/flash_messages";
import "./custom/gages_test";
import "./custom/inline_handlers";
import "./custom/swal_my_create";
import { registerServiceWorker } from "./custom/register_service_worker";
import { subscribeToPushNotifications } from "./custom/push_subscription";

Rails.start();
console.log("🔥 Rails UJS is loaded!", Rails);

window.bootstrap = bootstrap;

/* ===========================================================
   🛠 デバッグフラグ：URLに ?nosw=1 が付いていたら
   この端末・このブラウザだけ SW/Push を無効化
   =========================================================== */
const DEBUG_NO_SW = new URLSearchParams(location.search).has("nosw");

/* ===========================================================
   ✅ Push通知の二重呼び出し防止 + nosw時は未実行
   =========================================================== */
let __pushSubRequested = false;
function requestPushOnce() {
  if (DEBUG_NO_SW) return;            // ← デバッグ時は登録しない（この端末だけ）
  if (!window.isLoggedIn) return;
  if (__pushSubRequested) return;
  __pushSubRequested = true;
  subscribeToPushNotifications().catch(err => {
    console.error("Push通知登録エラー:", err);
  });
}

/** ▼▼▼ ここから保険 ▼▼▼ **/
function hideMobileSearchModalSafely() {
  const el = document.getElementById("mobile-super-search-modal");
  const BS = window.bootstrap && window.bootstrap.Modal;
  if (!el || !BS) return;

  const inst = BS.getInstance(el) || BS.getOrCreateInstance(el, { backdrop: true, keyboard: true });
  try { inst.hide(); } catch {}

  document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");

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

/* ===========================================================
   🔔 サービスワーカー登録（nosw時はこの端末だけ解除）
   =========================================================== */
if (DEBUG_NO_SW) {
  // この端末のこのブラウザだけ SW を解除＆キャッシュ掃除
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations?.()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .then(() => {
        if (window.caches?.keys) {
          caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
        }
        // 1回だけ SW なしで再読込（ループ防止）
        if (!sessionStorage.getItem("nosw_once_reloaded")) {
          sessionStorage.setItem("nosw_once_reloaded", "1");
          location.reload();
        }
      })
      .catch(err => console.warn("SW unregister failed:", err));
  }
  console.log("NO_SWモード：この端末のこのブラウザではSW未登録（デバッグ用）");
} else {
  // 通常運用：これまでどおり SW 有効
  registerServiceWorker();
}

// 重複する関数はここに書かない！！！

// ログインしているユーザーだけ実行（※二重防止関数経由）
document.addEventListener('DOMContentLoaded', () => {
  requestPushOnce();
});


// ===== Turboローディング制御（遅延 + スキップ対応）=====
let __loaderTimer = null;
let __skipNextLoader = false;

function __showLoader() {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.remove("view-hidden");
}
function __hideLoader() {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.add("view-hidden");
}
function __scheduleLoader(delayMs = 250) { // 体感で200〜300msに調整可
  clearTimeout(__loaderTimer);
  __loaderTimer = setTimeout(() => {
    if (!__skipNextLoader) __showLoader();
    __skipNextLoader = false; // 1回使い捨て
  }, delayMs);
}
function __cancelLoader() {
  clearTimeout(__loaderTimer);
  __loaderTimer = null;
  __hideLoader();
}

// data-no-loader が付いた要素からの操作は次回だけローダーを出さない
["click", "change", "submit"].forEach((t) => {
  document.addEventListener(
    t,
    (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-no-loader]") : null;
      if (el) __skipNextLoader = true;
    },
    true
  );
});

// フルページ遷移は“遅延してから”ローダー候補を出す
document.addEventListener("turbo:visit", (e) => {
  const nextUrl = e.detail?.url || "";
  // 同一URL(ハッシュ移動など)ならスキップ
  if (nextUrl && nextUrl.split("#")[0] === location.href.split("#")[0]) {
    __skipNextLoader = true;
  }
  __scheduleLoader(250);
});

// 描画/完了系イベントが来たら確実に消す（フリッカー防止）
["turbo:before-render", "turbo:render", "turbo:load", "turbo:frame-load", "turbo:before-cache", "pageshow"]
  .forEach((evt) => document.addEventListener(evt, __cancelLoader, true));


document.addEventListener("turbo:load", () => {
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.classList.add("view-hidden"); // 非表示

  // Push通知（※二重防止関数経由）
  requestPushOnce();

  // HPと日付保存
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem("hpDate");

  if (savedDate !== today) {
    localStorage.setItem("hpPercentage", "50");
    localStorage.setItem("hpDate", today);
  }

  // Turboフレーム内モーダルにも対応
  const modalFixObserver = new MutationObserver(() => {
    const modal = document.querySelector(".modal.show");
    const modalContent = document.querySelector(".modal-content");
    const loader3 = document.getElementById("loading-overlay");
    if (modal && modalContent && loader3) {
      loader3.classList.add("view-hidden");
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
    // console.warn("⚠️ アバター関連の要素が見つかりません（このページでは不要の可能性あり）");
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

  // === 重複バインド防止：ファイル選択 ===
  if (!fileInput.dataset.bound) {
    fileInput.dataset.bound = "1";

    fileInput.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (!file) return;

      // ここではサイズで弾かない（後で縮小）
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
  }

  // === 重複バインド防止：ドラッグ操作 ===
  if (!cropContainer.dataset.bound) {
    cropContainer.dataset.bound = "1";

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
  }

  // ★ 拡大しない・品質0.85のリサイズ関数
  async function resizeImage(sourceImage, maxSize = 300) {
    return new Promise((resolve) => {
      const srcW = sourceImage.width;
      const srcH = sourceImage.height;

      // 拡大禁止：scale は最大でも 1
      const scaleByW = maxSize / srcW;
      const scaleByH = maxSize / srcH;
      const scale = Math.min(1, Math.min(scaleByW, scaleByH));

      const dstW = Math.max(1, Math.round(srcW * scale));
      const dstH = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = dstW;
      canvas.height = dstH;

      ctx.drawImage(sourceImage, 0, 0, dstW, dstH);

      // JPEGで再エンコード（圧縮）
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/jpeg",
        0.85 // 画質はお好みで 0.8〜0.9
      );
    });
  }

  // === 重複バインド防止：確定ボタン ===
  if (!confirmBtn.dataset.bound) {
    confirmBtn.dataset.bound = "1";

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

      // ▼ フォーカスを外してからモーダルを閉じる（aria-hidden 対策）
      try { confirmBtn.blur(); } catch(_) {}
      try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch(_) {}
      modal.hide();

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
        avatarUrlField.value = dataUrl;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

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
      setTimeout(() => { cover.classList.add("view-hidden"); }, 200);
    }, 1200);
  }
}

window.addEventListener("DOMContentLoaded", hideScreenCover);
window.addEventListener("load", hideScreenCover);
document.addEventListener("turbo:load", hideScreenCover);

/* ===========================================================
   🔧 追加：record-modal-content を update した直後に必ず再 show
   （他機能は一切触らない）
   =========================================================== */
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

/* ===========================================================
   📱 スマホ版プレイリスト「一覧」モーダル（fetch なし）
   =========================================================== */
// ボタンにクリックをバインド（重複防止）
function bindMobilePlaylistButton() {
  const btn = document.getElementById("show-playlist-modal-mobile");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", function(e) {
    e.preventDefault();

    const modal = document.getElementById("playlist-modal-mobile");
    if (!modal) return;

    // 開く前に黒幕の残骸だけ軽掃除（他モーダルが開いていれば触らない）
    try {
      const anyOpen = document.querySelector(".modal.show");
      if (!anyOpen) {
        document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(el => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
        document.body.style.pointerEvents = "auto";
      }
    } catch (_) {}

    const BS = window.bootstrap && window.bootstrap.Modal;
    if (BS) {
      BS.getOrCreateInstance(modal, { backdrop: true, keyboard: true }).show();
    } else {
      // フォールバック（Bootstrap未ロード時）
      modal.style.display = "block";
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      modal.addEventListener("click", function(ev) {
        if (ev.target === modal) {
          modal.classList.remove("show");
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
        }
      }, { once: true });
    }
  });
}
document.addEventListener("DOMContentLoaded", bindMobilePlaylistButton);
document.addEventListener("turbo:load",      bindMobilePlaylistButton);
document.addEventListener("turbo:render",    bindMobilePlaylistButton);

// 保険：画面差し替えやキャッシュ保存前、復帰時に必ず閉じる
function hideMobilePlaylistModalSafely() {
  const el = document.getElementById("playlist-modal-mobile");
  const BS = window.bootstrap && window.bootstrap.Modal;
  if (!el) return;

  try { BS?.getInstance(el)?.hide(); } catch {}
  el.classList.remove("show");
  el.style.display = "none";
  el.setAttribute("aria-hidden", "true");

  document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
  document.body.classList.remove("modal-open");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
  document.body.style.pointerEvents = "auto";
}
document.addEventListener("turbo:before-render", hideMobilePlaylistModalSafely);
document.addEventListener("turbo:before-cache",  hideMobilePlaylistModalSafely);
document.addEventListener("turbo:visit",         hideMobilePlaylistModalSafely);
window.addEventListener("pageshow", (e) => { if (e.persisted) hideMobilePlaylistModalSafely(); });
