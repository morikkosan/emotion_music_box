// ✅ 最小限の修復版（差し替え用）
window._flashShownOnce = window._flashShownOnce || null;

(function () {
  function showFlashSwal(source = "直接呼び出し") {
    console.log(`📣 [${source}] showFlashSwal 実行`);

    const flashContainer = document.querySelector("#flash-container");
    const flashNotice = flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
    const flashAlert  = flashContainer?.dataset.flashAlert  || document.body.dataset.flashAlert;

    // --- 既に出したものなら絶対スキップ ---
    const key = flashNotice ? `flashNotice:${flashNotice}` : flashAlert ? `flashAlert:${flashAlert}` : null;
    if (window._flashShownOnce === key) {
      console.log("🚫 [Guard] 二重発火防止：同一内容はスキップ");
      return;
    }

    if (!window.Swal) {
      console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
      return;
    }

    // --- エラー（無条件で表示） ---
    if (flashAlert && flashAlert !== "すでにログイン済みです") {
      console.log("❌ アラート表示トリガー");
      window._flashShownOnce = key;
      Swal.fire({
        title: "エラー ❌",
        text: flashAlert,
        icon: "error",
        confirmButtonText: "閉じる",
        background: "linear-gradient(135deg, #00b3ff, #ff0088)",
        color: "#fff",
        customClass: { popup: "cyber-popup" },
        // ✅ ここだけ追加：閉じたらガード解除（次を出せるように）
        didClose: () => { window._flashShownOnce = null; }
      });
      document.body.dataset.flashAlert = "";
      flashContainer?.remove();
      return;
    }

    // --- 通知（同一内容なら1回だけ） ---
    if (flashNotice) {
      console.log("✅ SweetAlert 成功表示開始");
      window._flashShownOnce = key;
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
        // ✅ ここだけ追加：閉じたらガード解除（次を出せるように）
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
          setTimeout(() => {
            showFlashSwal("MutationObserver → setTimeout");
          }, 0);
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
