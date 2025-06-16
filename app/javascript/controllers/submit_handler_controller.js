import { Controller } from "@hotwired/stimulus";
import * as bootstrap from "bootstrap"; // すでに使っているなら OK

export default class extends Controller {
  static targets = ["submit"];

  connect() {
    console.log("📝 submit-handler connected");
    if (this.hasSubmitTarget) this.submitTarget.disabled = false;

    // カレンダー日付バグ対策
    setTimeout(() => {
      const dateInput = this.element.querySelector('input[type="date"]');
      if (dateInput) {
        dateInput.addEventListener("change", (e) => {
          e.target.value = e.target.value;
        });
      }
    }, 100);
  }

  submit(event) {
    event.preventDefault();
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.style.display = "flex";
    if (this.hasSubmitTarget) this.submitTarget.disabled = true;

    const form      = this.element;
    const formData  = new FormData(form);

    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // SweetAlert2 で成功を表示
          Swal.fire({
            title: "成功 🎉",
            text: data.message,      // Rails 側で返す JSON の 'message'
            icon: "success",
            confirmButtonText: "OK",
            timer: 2000,
            timerProgressBar: true,
            background: "linear-gradient(135deg, #00b3ff, #ff0088)",
            color: "#fff",
            customClass: { popup: "cyber-popup" }
          });

          // 既存の「プレイリスト作成フォームだけ」右上トースト
          if (form.id === "playlist-form") {
            const toastEl = document.getElementById("save-toast");
            if (toastEl) {
              const body = toastEl.querySelector(".toast-body");
              if (body) body.textContent = "プレイリストを作成しました！";
              bootstrap.Toast.getOrCreateInstance(toastEl).show();
            }
          }

          // HPバー反映／リダイレクト
          const redirect = () => { window.location.href = data.redirect_url };
          if (data.hp_today) {
            // HPバー更新等のアニメーションが終わってから
            setTimeout(redirect, 1500);
          } else {
            // 今日以外の記録なら警告だけ出して即リダイレクト
            Swal.fire({
              title: "完了",
              text: "記録は保存されましたが、HPゲージの反映は今日の記録のみです。",
              icon: "info",
              confirmButtonText: "OK",
              background: "linear-gradient(135deg, #00b3ff, #ff0088)",
              color: "#fff",
              customClass: { popup: "cyber-popup" }
            }).then(redirect);
          }
        } else {
          // バリデーションエラー
          Swal.fire({
            title: "エラー ❌",
            text: (data.errors || []).join("\n"),
            icon: "error",
            confirmButtonText: "閉じる",
            background: "linear-gradient(135deg, #00b3ff, #ff0088)",
            color: "#fff",
            customClass: { popup: "cyber-popup" }
          });
        }
      })
      .catch(error => {
        console.error("送信エラー:", error);
        Swal.fire({
          title: "送信エラー",
          text: "予期しないエラーが発生しました",
          icon: "error",
          confirmButtonText: "閉じる",
          background: "linear-gradient(135deg, #00b3ff, #ff0088)",
          color: "#fff",
          customClass: { popup: "cyber-popup" }
        });
      })
     .finally(() => {
  if (loader) loader.style.display = "none";

  // 成功時だけ送信ボタンを戻す（失敗時はそのまま無効化）
  if (this.resultSuccess && this.hasSubmitTarget) {
    this.submitTarget.disabled = false;
  }
});

  }
}
