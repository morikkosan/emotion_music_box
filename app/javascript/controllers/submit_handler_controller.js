import { Controller } from "@hotwired/stimulus";

function getTodayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export default class extends Controller {
  static targets = ["submit"];

  connect() {
    //console.log("📝 submit-handler connected");

    if (this.hasSubmitTarget) this.submitTarget.disabled = false;

    // 🩹 カレンダー日付のバグ対策：描画が完全に終わったあとにイベントを設定
    setTimeout(() => {
      const dateInput = this.element.querySelector('input[type="date"]');
      if (dateInput) {
        dateInput.addEventListener("change", (e) => {
          const val = e.target.value;
          //console.log("📌 遅延bind: カレンダーchangeイベント:", val);
          e.target.value = val; // 再代入で安定させる
        });
      }
    }, 100); // ← 必要なら200msに増やしてもOK
  }

  submit(event) {
  event.preventDefault();
  const loader = document.getElementById("loading-overlay");
  if (loader) loader.style.display = "flex";

  if (this.hasSubmitTarget) this.submitTarget.disabled = true;

  const form = this.element;
  const formData = new FormData(form);

  fetch(form.action, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: formData,
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // ここで「プレイリスト作成フォームだけ」右上トースト
        if (form.id === "playlist-form") {
            console.log("✅ playlist-form submit handler 発火！");
          const toastEl = document.getElementById("save-toast");
          if (toastEl) {
            const body = toastEl.querySelector(".toast-body");
            if (body) body.textContent = "プレイリストを作成しました！";
            const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
            toast.show();
          }
        }
        // 既存の他処理は壊さない
        if (data.hp_today) {
          // ...（既存のHPバーなどの処理はそのまま）...
          setTimeout(() => {
            window.location.href = data.redirect_url;
          }, 1500);
        } else {
          alert("記録は保存されましたが、HPゲージの反映は今日の記録のみです。");
          window.location.href = data.redirect_url;
        }
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
      const loader = document.getElementById("loading-overlay");
      if (loader) loader.style.display = "none";
    });
}
}