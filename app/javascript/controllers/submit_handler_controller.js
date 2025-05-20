import { Controller } from "@hotwired/stimulus";

function getTodayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export default class extends Controller {
  static targets = ["submit"];

  connect() {
    console.log("📝 submit-handler connected");
    if (this.hasSubmitTarget) this.submitTarget.disabled = false;
  }

  submit(event) {
    console.log("🟢 submit-handler: submitイベント発火");

    event.preventDefault();

    if (this.hasSubmitTarget) this.submitTarget.disabled = true;

    const form = this.element;
    const formData = new FormData(form);

    const formDate = formData.get("emotion_log[date]");
    const today = getTodayString();

    // 【日付の判定】
    if (formDate !== today) {
      console.log("今日以外の日付のためHPゲージ更新しません");

      fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert("記録は保存されましたが、HPゲージの反映は今日の記録のみです。");
            window.location.href = data.redirect_url;
          } else {
            alert("保存に失敗しました: " + (data.errors || []).join("\n"));
          }
        })
        .catch(error => {
          console.error("送信エラー:", error);
          alert("予期しないエラーが発生しました");
        })
        .finally(() => {
          if (this.hasSubmitTarget) this.submitTarget.disabled = false;
        });

      return;
    }

    // 今日の日付ならHPゲージ更新処理も含めて送信
    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const storedDate = localStorage.getItem("hpPercentageDate");
          if (storedDate !== today) {
            console.log("日付が変わったためHPゲージをリセット（50に戻す）");
            localStorage.setItem("hpPercentage", "50");
          }

          let hpPercentage = 50;
          const storedHP = parseFloat(localStorage.getItem("hpPercentage"));
          if (!isNaN(storedHP)) hpPercentage = storedHP;

          if (typeof data.hpPercentage !== "undefined") {
            console.log("サーバーから受け取ったhpPercentage = ", data.hpPercentage);
            hpPercentage += parseFloat(data.hpPercentage);
            hpPercentage = Math.max(0, Math.min(100, hpPercentage));
          }

          localStorage.setItem("hpPercentage", hpPercentage.toString());
          localStorage.setItem("hpPercentageDate", today);

          if (window.updateHPBar) window.updateHPBar();

          const toastEl = document.getElementById("save-toast");
          if (toastEl) {
            const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
            toast.show();
          }

          setTimeout(() => {
            window.location.href = data.redirect_url;
          }, 1500);
          return;
        }

        alert("保存に失敗しました: " + (data.errors || []).join("\n"));
      })
      .catch(error => {
        console.error("送信エラー:", error);
        alert("予期しないエラーが発生しました");
      })
      .finally(() => {
        if (this.hasSubmitTarget) this.submitTarget.disabled = false;
      });
  }
}
