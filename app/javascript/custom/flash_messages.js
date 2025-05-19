(function () {
  // Turbo遷移にも対応（DOMContentLoadedとturbo:load両方で動かす）
  function showFlashSwal() {
    let flashNotice = document.body.dataset.flashNotice;
    let flashAlert = document.body.dataset.flashAlert;

    // テストログ
    console.log("💡 showFlashSwal: notice =", flashNotice, ", alert =", flashAlert);

    // SweetAlert2が使えるかテスト
    if (window.Swal) {
      console.log("✅ Swal.fire 使えます", Swal);

      // テスト用（動作確認したい時だけ↓を有効に）
      // Swal.fire("Swal動作テスト", "これはテストです", "info");

      if (flashAlert === "すでにログイン済みです") {
  console.log("🟡 ログイン済み通知はモーダルを表示せずスキップ");
} else if (flashAlert) {
  Swal.fire({
    title: "エラー ❌",
    text: flashAlert,
    icon: "error",
    confirmButtonText: "閉じる",
    background: "linear-gradient(135deg, #00b3ff, #ff0088)",
    color: "#fff",
    customClass: { popup: "cyber-popup" }
  });
  console.log("✅ フラッシュalert表示");
} else if (flashNotice) {
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
  console.log("✅ フラッシュnotice表示");
}

    } else {
      console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
    }
    }


  document.addEventListener("DOMContentLoaded", showFlashSwal);
  document.addEventListener("turbo:load", showFlashSwal);

  // --- ログアウトポップアップ（DOM Readyのときのみで十分） ---
  document.addEventListener("DOMContentLoaded", function () {
    const logoutLink = document.getElementById("logout-link");
    if (!logoutLink) {
      console.log("ℹ️ logout-link が見つかりませんでした");
      return;
    }
    logoutLink.addEventListener("click", function (event) {
      event.preventDefault();
      console.log("ログアウトリンクがクリックされました");

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
        console.log("ポップアップの結果:", result);
        if (result.isConfirmed) {
          console.log("ログアウト処理を開始します");
          const logoutUrl = logoutLink.dataset.logoutUrl || logoutLink.href;
          const form = document.createElement('form');
          form.method = 'post';
          form.action = logoutUrl;

          // Rails の DELETEリクエスト化
          const methodInput = document.createElement('input');
          methodInput.type = 'hidden';
          methodInput.name = '_method';
          methodInput.value = 'delete';
          form.appendChild(methodInput);

          // CSRFトークン
          const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
          if (csrfTokenMeta) {
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = 'authenticity_token';
            csrfInput.value = csrfTokenMeta.content;
            form.appendChild(csrfInput);
          }
          document.body.appendChild(form);
          form.submit();
        } else {
          console.log("ログアウトがキャンセルされました");
        }
      }).catch((err) => {
        console.error("ポップアップエラー:", err);
      });
    });
  });

  // テスト用: このファイルの読込テスト
  console.log("🔥 custom_flash.js loaded:", Date.now());
})();
