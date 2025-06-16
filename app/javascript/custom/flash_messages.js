(function () {
  function showFlashSwal() {
    const flashContainer = document.querySelector("#flash-container");

    const flashNotice = flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
    const flashAlert  = flashContainer?.dataset.flashAlert  || document.body.dataset.flashAlert;

    if (!window.Swal) {
      console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
      return;
    }

    if (flashAlert === "すでにログイン済みです") return;

    // 🔴 エラーは無条件で表示
    if (flashAlert) {
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

    // 🟢 通知は同じ内容を連続表示しない
    if (flashNotice) {
      const key = `flashNotice:${flashNotice}`;
      if (!sessionStorage.getItem(key)) {
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
        sessionStorage.setItem(key, "shown");
      }
      document.body.dataset.flashNotice = "";
      flashContainer?.remove();
    }
  }

  document.addEventListener("DOMContentLoaded", showFlashSwal);
  document.addEventListener("turbo:load", showFlashSwal);

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      for (const node of mutation.addedNodes) {
        if (node.id === "flash-container") {
          showFlashSwal();
          return;
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

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
