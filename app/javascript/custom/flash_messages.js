// ✅ 最小限の修復版（差し替え用）
window._flashShownOnce = window._flashShownOnce || null;

(function () {
  function showFlashSwal(source = "直接呼び出し") {
    console.log(`📣 [${source}] showFlashSwal 実行`);

    const flashContainer = document.querySelector("#flash-container");
    const flashNotice = flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
    const flashAlert  = flashContainer?.dataset.flashAlert  || document.body.dataset.flashAlert;

    if (!window.Swal) {
      console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
      return;
    }

    // --- エラー（無条件で表示・alert優先） ---
    //   ガードも alert キーで判定・設定する
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
        // ✅ 閉じたらガード解除（次を出せるように）
        didClose: () => { window._flashShownOnce = null; }
      });
      document.body.dataset.flashAlert = "";
      flashContainer?.remove();
      return;
    }

    // --- 通知（同一内容なら1回だけ）
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
        // ✅ 閉じたらガード解除（次を出せるように）
        didClose: () => { window._flashShownOnce = null; }
      });
      document.body.dataset.flashNotice = "";
      flashContainer?.remove();
    }
  }

  window.showFlashSwal = showFlashSwal;

  // ✅ MutationObserverだけで呼び出し！
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      for (const node of mutation.addedNodes) {
        if (node.id === "flash-container") {
          console.log("👀 MutationObserver: flash-container 追加検出");
          /* istanbul ignore next */ // async scheduling は V8 で行カバレッジが不安定
          setTimeout(() => {
            showFlashSwal("MutationObserver → setTimeout");
          }, 0);
          /* istanbul ignore next */ // ネスト脱出だけの早期 return も V8 でズレやすい
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ✅ logout用イベントだけ残す（そのまま）
  document.addEventListener("DOMContentLoaded", function () {
    const logoutLink = document.getElementById("logout-link");
    if (!logoutLink) return;

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
        didClose: () => { window._flashShownOnce = null; } // ←保険
      }).then((result) => {
        if (result.isConfirmed) {
          const logoutUrl = logoutLink.dataset.logoutUrl || logoutLink.href;
          const form = document.createElement("form");
          form.method = "post";
          form.action = logoutUrl;

          const methodInput = document.createElement("input");
          methodInput.type = "hidden";
          methodInput.name = "_method";
          methodInput.value = "delete";
          form.appendChild(methodInput);

          const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
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
  });
})();

// （参考）これはSweetAlert2では発火しないけど残しても無害
document.addEventListener('hidden.bs.modal', function (event) {
  if (event.target?.classList?.contains('cyber-popup')) {
    window._flashShownOnce = null;
    console.log('🔄 [Guard] モーダル閉じでリセット');
  }
});
