import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["submit"]

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

    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // ←ここで送信前にlocalStorageから取得
          let hpPercentage = 0;
          const storedHP = parseFloat(localStorage.getItem("hpPercentage"));
          if (!isNaN(storedHP)) hpPercentage = storedHP;

          // サーバーから受け取ったhpPercentageを加算
          if (typeof data.hpPercentage !== "undefined") {
            console.log("サーバーから受け取ったhpPercentage = ", data.hpPercentage);
            hpPercentage += parseFloat(data.hpPercentage);
            hpPercentage = Math.max(0, Math.min(100, hpPercentage));
            localStorage.setItem("hpPercentage", hpPercentage.toString());
            if (window.updateHPBar) window.updateHPBar();
          }

          // トースト表示やリダイレクトは同じ
          const toastEl = document.getElementById("save-toast");
          if (toastEl) {
            const toast = bootstrap.Toast.getOrCreateInstance(toastEl)
            toast.show()
          }
          setTimeout(() => {
            window.location.href = data.redirect_url
          }, 1500)
          return;
        }
        // エラー時
        if (this.hasSubmitTarget) this.submitTarget.disabled = false;
        alert("保存に失敗しました: " + (data.errors || []).join("\n"));
      })
      .catch(error => {
        console.error("送信エラー:", error)
        if (this.hasSubmitTarget) this.submitTarget.disabled = false;
        alert("予期しないエラーが発生しました")
      })
  }
}
