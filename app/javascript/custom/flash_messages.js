// ✅ 最小限の修復版（ファイル追加なし・既存ファイルのみ修正）
window._flashShownOnce = window._flashShownOnce || null;

(function () {
  // --- 追加：モーダル残骸を必ず掃除（Bootstrapの黒幕・body状態）
  function cleanupModalArtifacts(_source = "cleanup") {
    try {
      document.querySelectorAll(".modal.show").forEach((m) => {
        try {
          const inst =
            window.bootstrap?.Modal?.getInstance?.(m) ||
            (window.bootstrap?.Modal ? new window.bootstrap.Modal(m) : null);
          if (inst) inst.hide();
        } catch (_) {
          m.classList.remove("show");
          m.setAttribute("aria-hidden", "true");
          m.style.display = "none";
        }
      });
    } catch (_) {}

    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  }

  function showFlashSwal(source = "直接呼び出し") {
    console.log(`📣 [${source}] showFlashSwal 実行`);

    // ★ スマホ黒画面対策：まず掃除
    cleanupModalArtifacts("showFlashSwal");

    const flashContainer = document.querySelector("#flash-container");
    const flashNotice =
      flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
    const flashAlert =
      flashContainer?.dataset.flashAlert || document.body.dataset.flashAlert;

    if (!window.Swal) {
      console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
      return;
    }

    // --- エラー（alert優先）
    if (flashAlert && flashAlert !== "すでにログイン済みです") {
      const alertKey = `flashAlert:${flashAlert}`;
      if (window._flashShownOnce === alertKey) {
        console.log("🚫 [Guard] 二重発火防止（alert）：同一内容はスキップ");
        return;
      }

      console.log("❌ アラート表示トリガー");
      window._flashShownOnce = alertKey;
      Swal.fire({
        title: "エラー ❌",
        text: flashAlert,
        icon: "error",
        confirmButtonText: "閉じる",
        background: "linear-gradient(135deg, #00b3ff, #ff0088)",
        color: "#fff",
        customClass: { popup: "cyber-popup" },
        didClose: () => {
          window._flashShownOnce = null;
        },
      });
      document.body.dataset.flashAlert = "";
      flashContainer?.remove();
      return;
    }

    // --- 通知（同一内容なら1回）
    if (flashNotice) {
      const noticeKey = `flashNotice:${flashNotice}`;
      if (window._flashShownOnce === noticeKey) {
        console.log("🚫 [Guard] 二重発火防止（notice）：同一内容はスキップ");
        return;
      }

      console.log("✅ SweetAlert 成功表示開始");
      window._flashShownOnce = noticeKey;
      Swal.fire({
        title: "成功 🎉",
        text: flashNotice,
        icon: "success",
        confirmButtonText: "OK",
        background: "linear-gradient(135deg, #00b3ff, #ff0088)",
        color: "#fff",
        timer: 3000,
        timerProgressBar: true,
        customClass: { popup: "cyber-popup" },
        didClose: () => {
          window._flashShownOnce = null;
        },
      });
      document.body.dataset.flashNotice = "";
      flashContainer?.remove();
    }
  }

  window.showFlashSwal = showFlashSwal;

  // ✅ (A) 動的追加を監視
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      for (const node of mutation.addedNodes) {
        if (node.id === "flash-container") {
          console.log("👀 MutationObserver: flash-container 追加検出");

          // ★ まず掃除（黒幕残り対策）
          cleanupModalArtifacts("observer");

          /* c8 ignore start */
          /* istanbul ignore next */
          setTimeout(showFlashSwal.bind(null, "MutationObserver → setTimeout"), 0);
          /* istanbul ignore next */
          return;
          /* c8 ignore stop */
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ✅ (B) フルリロードでも表示
  document.addEventListener("DOMContentLoaded", function () {
    const hasFlash =
      document.querySelector("#flash-container") ||
      document.body.dataset.flashNotice ||
      document.body.dataset.flashAlert;

    if (hasFlash) {
      cleanupModalArtifacts("DOMContentLoaded");
      setTimeout(showFlashSwal.bind(null, "DOMContentLoaded"), 0);
    }

    // --- (D-1) a#logout-link（既存テスト互換）
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.addEventListener("click", function (event) {
        event.preventDefault();

        if (!window.Swal) {
          alert("Swalが見つかりません！通常のログアウト処理にします。");
          location.href = logoutLink.href;
          return;
        }

        Swal.fire({
          title: "今日はもう帰りますか？",
          text: "この後、ログアウトしますか？",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "はい、帰ります",
          cancelButtonText: "キャンセル",
          background: "linear-gradient(135deg, #00b3ff, #ff0088)",
          color: "#fff",
          customClass: { popup: "cyber-popup" },
          didClose: () => {
            window._flashShownOnce = null;
          },
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

            const csrfTokenMeta = document.querySelector(
              'meta[name="csrf-token"]'
            );
            if (csrfTokenMeta) {
              const csrfInput = document.createElement("input");
              csrfInput.type = "hidden";
              csrfInput.name = "authenticity_token";
              csrfInput.value = csrfTokenMeta.content;
              form.appendChild(csrfInput);
            }

            document.body.appendChild(form);
            form.submit();
          }
        });
      });
    }

    // --- (D-2) button_to の form[data-logout-form="true"] もサポート
    const logoutForms = document.querySelectorAll('form[data-logout-form="true"]');
    logoutForms.forEach((form) => {
      // さらに保険：/sign_out っぽいか
      try {
        const url = new URL(form.action, window.location.origin);
        if (!/\/sign_out(?:$|[\?#])/.test(url.pathname)) return;
      } catch (_) {}

      let confirming = false;
      form.addEventListener("submit", function (event) {
        if (confirming) return;
        if (!window.Swal) return; // Swalが無ければ普通に送信

        event.preventDefault();
        Swal.fire({
          title: "今日はもう帰りますか？",
          text: "この後、ログアウトしますか？",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "はい、帰ります",
          cancelButtonText: "キャンセル",
          background: "linear-gradient(135deg, #00b3ff, #ff0088)",
          color: "#fff",
          customClass: { popup: "cyber-popup" },
          didClose: () => {
            window._flashShownOnce = null;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            confirming = true;
            form.submit();
          }
        });
      });
    });
  });

  // ✅ (C) bfcache 戻る（Safari等）にも対応
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      const hasFlash =
        document.querySelector("#flash-container") ||
        document.body.dataset.flashNotice ||
        document.body.dataset.flashAlert;

      if (hasFlash) {
        cleanupModalArtifacts("pageshow");
        setTimeout(showFlashSwal.bind(null, "pageshow(bfcache)"), 0);
      }
    }
  });
})();

// 参考：Bootstrapのイベント経由（オプショナル）
document.addEventListener("hidden.bs.modal", function (event) {
  if (event.target?.classList?.contains("cyber-popup")) {
    window._flashShownOnce = null;
    console.log("🔄 [Guard] モーダル閉じでリセット");
  }
});