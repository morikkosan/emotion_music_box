// app/javascript/flash_swal.js
(function () {
  // 他モーダルを壊さない掃除（黒幕だけ・開いてるモーダルがあれば何もしない）
  function cleanupModalArtifacts() {
    try {
      const anyOpen = document.querySelector(".modal.show");
      if (!anyOpen) {
        document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach((el) => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
      }
    } catch (_) {}
  }

  // 短時間の重複だけ弾く（別リクエストは弾かない）
  function rateLimit() {
    const now = performance.now();
    if (now < (window.__flashBlockUntil || 0)) return true;
    window.__flashBlockUntil = now + 200; // 200ms 以内の連打のみ抑止
    return false;
  }

  function showFlashSwal(source = "auto") {
    if (rateLimit()) return;

    const flashContainer = document.querySelector("#flash-container");
    const flashNotice =
      flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
    const flashAlert =
      flashContainer?.dataset.flashAlert || document.body.dataset.flashAlert;

    if (!flashNotice && !flashAlert) return;
    if (!window.Swal || typeof window.Swal.fire !== "function") return;

    cleanupModalArtifacts(); // 黒幕だけ掃除

    if (flashAlert && flashAlert !== "すでにログイン済みです") {
      Swal.fire({
        title: "エラー ❌",
        text: flashAlert,
        icon: "error",
        confirmButtonText: "閉じる",
        didClose: () => {
          // 片付けは閉じた時にだけ（競合回避）
          try { document.body.dataset.flashAlert = ""; } catch (_) {}
          try { flashContainer?.remove(); } catch (_) {}
        },
      });
      return;
    }

    if (flashNotice) {
      Swal.fire({
        title: "成功 🎉",
        text: flashNotice,
        icon: "success",
        confirmButtonText: "OK",
        didClose: () => {
          try { document.body.dataset.flashNotice = ""; } catch (_) {}
          try { flashContainer?.remove(); } catch (_) {}
        },
      });
      return;
    }
  }

  // 互換：既存コードが呼ぶかもしれない関数名に合わせる
  window.showFlashSwal = showFlashSwal;
  window.showFlashMessages = window.showFlashMessages || showFlashSwal;

  // 1) DOM 挿入監視：#flash-container が追加されたら実行
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.id === "flash-container") {
          cleanupModalArtifacts();
          queueMicrotask(() => showFlashSwal("mutation"));
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 2) 初回ロード・bfcache 戻り
  document.addEventListener("DOMContentLoaded", () => {
    const hasFlash =
      document.querySelector("#flash-container") ||
      document.body.dataset.flashNotice ||
      document.body.dataset.flashAlert;
    if (hasFlash) {
      cleanupModalArtifacts();
      queueMicrotask(() => showFlashSwal("DOMContentLoaded"));
    }
  });
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    const hasFlash =
      document.querySelector("#flash-container") ||
      document.body.dataset.flashNotice ||
      document.body.dataset.flashAlert;
    if (hasFlash) {
      cleanupModalArtifacts();
      queueMicrotask(() => showFlashSwal("pageshow"));
    }
  });
})();
