window._flashShownOnce = window._flashShownOnce || null;

(function () {
  function showFlashSwal(source = "直接呼び出し") {
    console.log(`📣 [${source}] showFlashSwal 実行`);

    const flashContainer = document.querySelector("#flash-container");
    console.log("🔎 flashContainer:", flashContainer);

    const flashNotice = flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
    const flashAlert = flashContainer?.dataset.flashAlert || document.body.dataset.flashAlert;

    console.log("🔥 Flash Notice:", flashNotice);
    console.log("🔥 Flash Alert:", flashAlert);

    if (!window.Swal) {
      console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
      return;
    }

    if (flashAlert === "すでにログイン済みです") return;

    // 🔴 エラー（無条件で表示）
    if (flashAlert) {
      console.log("❌ アラート表示トリガー");
      Swal.fire({
        title: "エラー ❌",
        text: flashAlert,
        icon: "error",
        confirmButtonText: "閉じる",
        background: "linear-gradient(135deg, #00b3ff, #ff0088)",
        color: "#fff",
        customClass: { popup: "cyber-popup" }
      });
      document.body.dataset.flashAlert = "";
      flashContainer?.remove();
      return;
    }

    // 🟢 通知（同一内容なら1回だけ）
    if (flashNotice) {
      const key = `flashNotice:${flashNotice}`;
      console.log("🟢 key:", key);
      console.log("🧠 _flashShownOnce:", window._flashShownOnce);

      if (window._flashShownOnce && window._flashShownOnce !== key) {
        console.log("🧹 前回の記録クリア");
        window._flashShownOnce = null;
      }

      if (window._flashShownOnce !== key) {
        console.log("✅ SweetAlert 成功表示開始");
        Swal.fire({
          title: "成功 🎉",
          text: flashNotice,
          icon: "success",
          confirmButtonText: "OK",
          background: "linear-gradient(135deg, #00b3ff, #ff0088)",
          color: "#fff",
          timer: 3000,
          timerProgressBar: true,
          customClass: { popup: "cyber-popup" }
        });
        window._flashShownOnce = key;
      } else {
        console.log("🚫 同一メッセージのためスキップ");
      }

      document.body.dataset.flashNotice = "";
      flashContainer?.remove();
    }
  }

  window.showFlashSwal = showFlashSwal;

  document.addEventListener("DOMContentLoaded", () => showFlashSwal("DOMContentLoaded"));
  document.addEventListener("turbo:load", () => showFlashSwal("turbo:load"));

  // ✅ MutationObserver 強化版
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      for (const node of mutation.addedNodes) {
        if (node.id === "flash-container") {
  console.log("👀 MutationObserver: flash-container 追加検出");
  window._flashShownOnce = null; // ← ここで毎回リセット！
  setTimeout(() => {
    showFlashSwal("MutationObserver → setTimeout");
  }, 0);
  return;
}

      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("turbo:before-stream-render", (event) => {
    const template = event.target;
    if (template.innerHTML.includes('id="flash-container"')) {
      console.log("📦 turbo:before-stream-render: flash-container が stream に含まれてる");
      setTimeout(() => {
        showFlashSwal("turbo:before-stream-render → setTimeout");
      }, 0);
    }
  });

  // ✅ logout確認用
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
        color: "#fff"
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
