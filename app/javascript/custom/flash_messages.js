(function() {
  document.addEventListener("DOMContentLoaded", function() {
    let flashNotice = document.body.dataset.flashNotice;
    let flashAlert = document.body.dataset.flashAlert;
    const logoutLink = document.getElementById("logout-link");

    const cyberPopupStyle = {
      background: "linear-gradient(135deg, #00b3ff, #ff0088)",
      color: "#fff"
    };

    // 成功メッセージ
    if (flashNotice) {
      Swal.fire({
        title: "成功 🎉",
        text: flashNotice,
        icon: "success",
        confirmButtonText: "OK",
        background: cyberPopupStyle.background,
        color: cyberPopupStyle.color,
        timer: 3000, // 自動で閉じる（3秒）
        timerProgressBar: true,
        customClass: {
          popup: "cyber-popup"
        }
      });
    }

    // エラーメッセージ
    if (flashAlert) {
      Swal.fire({
        title: "エラー ❌",
        text: flashAlert,
        icon: "error",
        confirmButtonText: "閉じる",
        background: cyberPopupStyle.background,
        color: cyberPopupStyle.color,
        customClass: {
          popup: "cyber-popup"
        }
      });
    }

    // 追加のカスタムポップアップ（「今日はもう帰りますか？」）
    if (logoutLink) {
      logoutLink.addEventListener("click", function(event) {
        event.preventDefault(); // 通常のリンク遷移を防ぐ
        console.log("ログアウトリンクがクリックされました");

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

            // ログアウトURLを data 属性から取得
            const logoutUrl = logoutLink.dataset.logoutUrl;
            // DELETE リクエストを送信するフォームを作成して送信
            const form = document.createElement('form');
            form.method = 'post';
            form.action = logoutUrl;

            // Rails の DELETE リクエストを模倣するために _method を追加
            const methodInput = document.createElement('input');
            methodInput.type = 'hidden';
            methodInput.name = '_method';
            methodInput.value = 'delete';
            form.appendChild(methodInput);

            // CSRF トークンを追加（meta タグから取得）
            const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = 'authenticity_token';
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);

            document.body.appendChild(form);
            form.submit();
          } else {
            console.log("ログアウトがキャンセルされました");
          }
        }).catch((err) => {
          console.error("ポップアップエラー:", err);
        });
      });
    }
  });
})();
