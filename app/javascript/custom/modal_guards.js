// app/javascript/custom/modal_guards.js

// ===== 検索モーダル（mobile-super-search-modal）を安全に閉じる =====
function hideMobileSearchModalSafely() {
  const el = document.getElementById("mobile-super-search-modal");
  const BS = window.bootstrap && window.bootstrap.Modal;
  if (!el) return;

  // テスト互換：getInstance() なければ getOrCreateInstance() で生成し、必ず inst.hide() を試みる
  try {
    const inst =
      (BS && BS.getInstance && BS.getInstance(el)) ||
      (BS && BS.getOrCreateInstance && BS.getOrCreateInstance(el, { backdrop: true, keyboard: true }));
    if (inst && typeof inst.hide === "function") inst.hide();
  } catch {}

  // 後始末（黒幕・body状態を確実にリセット）
  try {
    document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(b => b.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
    document.body.style.pointerEvents = "auto";
  } catch {}

  // 要素側の可視状態も閉じる
  el.classList.remove("show");
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
}

// Turbo の画面差し替え前／キャッシュ前／訪問開始で毎回閉じる
document.addEventListener("turbo:before-render", hideMobileSearchModalSafely);
document.addEventListener("turbo:before-cache",  hideMobileSearchModalSafely);
document.addEventListener("turbo:visit",         hideMobileSearchModalSafely);

// bfcache 復帰（戻る）でも閉じる
window.addEventListener("pageshow", (e) => { if (e.persisted) hideMobileSearchModalSafely(); });


// ===== 📱 プレイリスト「一覧」モーダル（playlist-modal-mobile） =====
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
    } catch {}

    const BS = window.bootstrap && window.bootstrap.Modal;
    if (BS && BS.getOrCreateInstance) {
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


// 画面差し替えやキャッシュ保存前、復帰時に必ず閉じる（プレイリスト）
function hideMobilePlaylistModalSafely() {
  const el = document.getElementById("playlist-modal-mobile");
  const BS = window.bootstrap && window.bootstrap.Modal;
  if (!el) return;

  // getInstance() || getOrCreateInstance() → hide()
  try {
    const inst =
      (BS && BS.getInstance && BS.getInstance(el)) ||
      (BS && BS.getOrCreateInstance && BS.getOrCreateInstance(el, { backdrop: true, keyboard: true }));
    if (inst && typeof inst.hide === "function") inst.hide();
  } catch {}

  el.classList.remove("show");
  el.style.display = "none";
  el.setAttribute("aria-hidden", "true");

  try {
    document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(b => b.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
    document.body.style.pointerEvents = "auto";
  } catch {}
}
document.addEventListener("turbo:before-render", hideMobilePlaylistModalSafely);
document.addEventListener("turbo:before-cache",  hideMobilePlaylistModalSafely);
document.addEventListener("turbo:visit",         hideMobilePlaylistModalSafely);
window.addEventListener("pageshow", (e) => { if (e.persisted) hideMobilePlaylistModalSafely(); });
