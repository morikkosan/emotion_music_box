// app/javascript/custom/flash_messages.js
// SweetAlert2 でフラッシュを「常に1回だけ」表示する統一版。
//  - turbo-stream で append された #flash-container を検知→即表示→即削除
//  - 初回ロード / Turbo遷移 / bfcache 戻りでも安定
//  - 同一メッセージの二重表示を抑止（sessionStorage ダイジェスト + 即時ガード）
//  - モーダル黒幕掃除は安全運転（開いてるモーダルがあれば何もしない）
//  - 互換API: window.showFlashSwal / window.showFlashMessages
//  - ログアウト確認（#logout-link / form[data-logout-form="true"]）も維持

(function () {
  "use strict";

  // ===== 二重初期化防止 =====
  if (window.__FLASH_MESSAGES_INIT__) return;
  window.__FLASH_MESSAGES_INIT__ = true;

  const DIGEST_KEY = "__FLASH_SWAL_DIGEST__";     // 同一ナビで同一内容の再表示を抑止
  let lastDigestInTick = null;                    // 同一イベントループ内の連続発火を即時ガード

  // ===== ユーティリティ =====
  function digestFor(path, type, text) {
    const raw = `${path}::${type}::${text}`;
    try {
      return btoa(unescape(encodeURIComponent(raw))).slice(0, 160);
    } catch (_) {
      return raw.slice(0, 160);
    }
  }

  // 他モーダルを壊さない掃除（黒幕だけ・開いてるモーダルがあれば何もしない）
  function cleanupBackdrops() {
    try {
      const anyOpen = document.querySelector(".modal.show");
      if (!anyOpen) {
        document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach((el) => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
        // 念のため：タップ不可状態を解除
        document.body.style.pointerEvents = "auto";
      }
    } catch (_) {}
  }

  // 短時間の重複だけ弾く（別リクエストは弾かない）
  function rateLimit(ms = 200) {
    const now = performance.now();
    if (now < (window.__flashBlockUntil || 0)) return true;
    window.__flashBlockUntil = now + ms;
    return false;
  }

  // ===== フラッシュ読み取り =====
  function readFlashFrom(el) {
    const notice = el?.dataset?.flashNotice || document.body.dataset.flashNotice || "";
    const alert  = el?.dataset?.flashAlert  || document.body.dataset.flashAlert  || "";
    if (!notice && !alert) return null;

    // alert 優先
    const type = alert ? "alert" : "notice";
    const text = alert || notice;
    return { type, text };
  }

  // ===== 表示（同一ナビ・同一内容なら抑止） =====
  function showSwalOnce(payload, _source = "auto") {
    if (!payload) return;
    if (rateLimit()) return;

    const path = window.location.pathname + window.location.search;
    const digest = digestFor(path, payload.type, payload.text);

    // 即時ガード（同tick内の多重発火）
    if (lastDigestInTick === digest) return;
    lastDigestInTick = digest;
    queueMicrotask(() => { lastDigestInTick = null; });

    // 同一ナビ抑止（セッション内）
    const prev = sessionStorage.getItem(DIGEST_KEY);
    if (prev === digest) return;
    sessionStorage.setItem(DIGEST_KEY, digest);

    // 表示前に黒幕だけ軽掃除
    cleanupBackdrops();

    if (!window.Swal || typeof window.Swal.fire !== "function") {
      // SweetAlert2 が無い場合のフォールバック
      try { alert(payload.text); } catch (_) {}
      return;
    }

    const isAlert = payload.type === "alert";

    window.Swal.fire({
      title: isAlert ? "エラー ❌" : "成功 🎉",
      text: payload.text,
      icon: isAlert ? "error" : "success",
      confirmButtonText: isAlert ? "閉じる" : "OK",
      // テーマは必要に応じてどうぞ
      background: "linear-gradient(135deg, #00b3ff, #ff0088)",
      color: "#fff",
      timer: isAlert ? undefined : 3000,
      timerProgressBar: !isAlert,
      customClass: { popup: "cyber-popup" }, // 互換: 既存CSSを活かす
      didClose: () => {
        // 次のメッセージに備えて軽掃除
        cleanupBackdrops();
      }
    });
  }

  // ===== 消費＆削除（他スクリプトに拾わせない） =====
  function consumeAndRemove(el) {
    try {
      document.body.dataset.flashNotice = "";
      document.body.dataset.flashAlert  = "";
      if (el) {
        el.innerHTML = "";
        el.remove();
      }
    } catch (_) {}
  }

  // ===== メイン処理 =====
  function processFlash(source = "auto") {
    const el = document.getElementById("flash-container");
    if (!el && !document.body.dataset.flashNotice && !document.body.dataset.flashAlert) return;

    // 二重append対策：1回処理したらマーク
    if (el && el.dataset.processed === "1") {
      consumeAndRemove(el);
      return;
    }
    if (el) el.dataset.processed = "1";

    const payload = readFlashFrom(el);
    if (!payload) {
      consumeAndRemove(el);
      return;
    }

    showSwalOnce(payload, source);
    consumeAndRemove(el);
  }

  // ===== 互換API（既存呼び出しを壊さない） =====
  function showFlashSwal(source = "manual") {
    // body の data-* に入れてあるケースにも対応
    let el = document.getElementById("flash-container");
    if (!el && (document.body.dataset.flashNotice || document.body.dataset.flashAlert)) {
      // ダミーでも動くように一時生成（すぐ消える）
      el = document.createElement("div");
      el.id = "flash-container";
      el.dataset.flashNotice = document.body.dataset.flashNotice || "";
      el.dataset.flashAlert  = document.body.dataset.flashAlert  || "";
      document.body.appendChild(el);
    }
    processFlash(source);
  }
  window.showFlashSwal = showFlashSwal;
  window.showFlashMessages = window.showFlashMessages || showFlashSwal;

  // ===== 監視・イベント =====
  // 1) turbo-stream append で #flash-container が追加されたら即処理
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.id === "flash-container") {
          // remove→append の直後でも確実に動くように microtask に乗せる
          queueMicrotask(() => processFlash("mutation"));
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 2) 初回ロード
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("flash-container") ||
        document.body.dataset.flashNotice ||
        document.body.dataset.flashAlert) {
      queueMicrotask(() => processFlash("DOMContentLoaded"));
    }

    // --- ログアウトUI（互換）
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.addEventListener("click", function (event) {
        event.preventDefault();
        if (!window.Swal) { location.href = logoutLink.href; return; }

        window.Swal.fire({
          title: "今日はもう帰りますか？",
          text: "この後、ログアウトしますか？",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "はい、帰ります",
          cancelButtonText: "キャンセル",
          background: "linear-gradient(135deg, #00b3ff, #ff0088)",
          color: "#fff",
          customClass: { popup: "cyber-popup" }
        }).then((result) => {
          if (result.isConfirmed) {
            const form = document.createElement("form");
            form.method = "post";
            form.action = logoutLink.dataset.logoutUrl || logoutLink.href;

            const methodInput = document.createElement("input");
            methodInput.type = "hidden";
            methodInput.name = "_method";
            methodInput.value = "delete";
            form.appendChild(methodInput);

            const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
            if (csrf) {
              const csrfInput = document.createElement("input");
              csrfInput.type = "hidden";
              csrfInput.name = "authenticity_token";
              csrfInput.value = csrf;
              form.appendChild(csrfInput);
            }

            document.body.appendChild(form);
            form.submit();
          }
        });
      });
    }

    // button_to（form[data-logout-form="true"]）対応
    const logoutForms = document.querySelectorAll('form[data-logout-form="true"]');
    logoutForms.forEach((form) => {
      try {
        const url = new URL(form.action, window.location.origin);
        if (!/\/sign_out(?:$|[\?#])/.test(url.pathname)) return;
      } catch (_) {}

      let confirming = false;
      form.addEventListener("submit", function (event) {
        if (confirming) return;
        if (!window.Swal) return; // Swal 無ければそのまま送信
        event.preventDefault();

        window.Swal.fire({
          title: "今日はもう帰りますか？",
          text: "この後、ログアウトしますか？",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "はい、帰ります",
          cancelButtonText: "キャンセル",
          background: "linear-gradient(135deg, #00b3ff, #ff0088)",
          color: "#fff",
          customClass: { popup: "cyber-popup" }
        }).then((result) => {
          if (result.isConfirmed) {
            confirming = true;
            form.submit();
          }
        });
      });
    });
  });

  // 3) bfcache 戻り
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (document.getElementById("flash-container") ||
        document.body.dataset.flashNotice ||
        document.body.dataset.flashAlert) {
      queueMicrotask(() => processFlash("pageshow"));
    }
  });


  // 4) Turbo遷移直後は黒幕の軽掃除（他モーダルが開いていれば何もしない）
  document.addEventListener("turbo:load", cleanupBackdrops);

  // 参考：Bootstrapのイベント（モーダル閉じたら軽くリセット）
  document.addEventListener("hidden.bs.modal", function () {
    cleanupBackdrops();
  });
})();
