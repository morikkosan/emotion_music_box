"use strict";

// ==============================
// HPバーの更新関数（グローバル）
// ==============================
window.updateHPBar = function () {
  // 複数存在する #hp-bar を全部対象にする（ID重複対策）
  const bars = Array.from(document.querySelectorAll("#hp-bar"));
  const hpStatusText = document.getElementById("hp-status-text");
  const barWidthDisplay = document.getElementById("bar-width-display");
  const barWidthDisplayMobile = document.getElementById("bar-width-display-mobile");

  if (bars.length === 0) return;

  // 親要素の横幅が0なら表示されるまで待つ（先頭バー基準）
  const track = bars[0].parentElement;
  if (track && track.offsetWidth === 0) {
    requestAnimationFrame(() => {
      if (track.offsetWidth > 0) {
        window.updateHPBar();
      } else {
        const ro = new ResizeObserver(() => {
          if (track.offsetWidth > 0) {
            ro.disconnect();
            window.updateHPBar();
          }
        });
        ro.observe(track);
      }
    });
    return;
  }

  let storedHP = localStorage.getItem("hpPercentage");
  let hpPercentage = (storedHP !== null && !isNaN(parseFloat(storedHP)))
    ? parseFloat(storedHP)
    : 50;

  hpPercentage = Math.min(100, Math.max(0, hpPercentage));
  const barWidth = hpPercentage + "%";

  // 全バーに反映
  bars.forEach(b => {
    b.style.width = barWidth;
    b.dataset.width = barWidth;
  });

  if (barWidthDisplay) barWidthDisplay.innerText = barWidth;
  if (barWidthDisplayMobile) barWidthDisplayMobile.innerText = barWidth;

  // 文言更新は要素があるときだけ
  const paint = (color) => bars.forEach(b => (b.style.backgroundColor = color));
  if (hpPercentage <= 20) {
    paint("red");
    if (hpStatusText) hpStatusText.innerText = "🆘 ストレス危険 🆘";
  } else if (hpPercentage <= 40) {
    paint("yellow");
    if (hpStatusText) hpStatusText.innerText = "🏥 ちょっと休みましょ 🏥";
  } else if (hpPercentage <= 70) {
    paint("#9ACD32");
    if (hpStatusText) hpStatusText.innerText = "♪ おつかれさまです ♪";
  } else {
    paint("green");
    if (hpStatusText) hpStatusText.innerText = "🩺 メンタル正常 🌿";
  }
};

// =======================================
// おすすめページに遷移（保存値から取得）
// =======================================
window.goToRecommended = function () {
  const storedHP = localStorage.getItem("hpPercentage");
  const hp = parseInt(storedHP, 10);
  if (!isNaN(hp)) {
    window.location.href = `/emotion_logs/recommended?hp=${hp}`;
  } else {
    alert("HPゲージの値が取得できませんでした");
  }
};

// ==============================
// 「フォームと同期」ロジック
// ==============================
const HP_INPUT_SELECTORS = [
  '[name="emotion_log[hp]"]',
  '[name="hp"]',
  '#hp',
  '#hp-input',
  '.js-hp-input'
].join(",");

function setHPAndRefresh(hpLike) {
  const n = Math.min(100, Math.max(0, Number(hpLike)));
  if (Number.isFinite(n)) {
    localStorage.setItem("hpPercentage", String(n));
    window.updateHPBar();
  }
}

function getHPFromDocument(root = document) {
  const el = root.querySelector(HP_INPUT_SELECTORS);
  if (!el) return null;
  const raw = el.value ?? el.getAttribute("value") ?? el.dataset.value;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.matches(HP_INPUT_SELECTORS)) {
    const v = parseFloat(t.value);
    if (Number.isFinite(v)) setHPAndRefresh(v);
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  const v = getHPFromDocument(form);
  if (v !== null) setHPAndRefresh(v);
}, true);

document.addEventListener("turbo:submit-end", (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  const status =
    e.detail?.fetchResponse?.response?.status ??
    (e.detail?.success === true ? 200 : 0);
  if (status >= 200 && status < 400) {
    const v = getHPFromDocument(form);
    if (v !== null) setHPAndRefresh(v);
  }
});

// ==============================
// 反映タイミング（ここが肝）
// ==============================
// Turbo系は document に
["DOMContentLoaded", "turbo:load", "turbo:render", "turbo:frame-load"].forEach(evt =>
  document.addEventListener(evt, () => window.updateHPBar())
);

// ブラウザ系は window に
["pageshow", "resize", "orientationchange"].forEach(evt =>
  window.addEventListener(evt, () => window.updateHPBar())
);

// Bootstrap系UI（モーダル等）は document に（キャプチャでOK）
["shown.bs.modal", "shown.bs.tab", "shown.bs.offcanvas"].forEach(evt =>
  document.addEventListener(evt, () => window.updateHPBar(), true)
);

// 追加の保険：#hp-bar が後からDOMに挿入されたら一度だけ反映
(function ensureHPBarOnce() {
  if (document.getElementById("hp-bar")) {
    window.updateHPBar();
    return;
  }
  const mo = new MutationObserver(() => {
    if (document.getElementById("hp-bar")) {
      mo.disconnect();
      window.updateHPBar();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
