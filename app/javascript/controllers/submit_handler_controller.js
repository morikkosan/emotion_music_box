// app/javascript/controllers/submit_handler_controller.js
import { Controller } from "@hotwired/stimulus";
import * as bootstrap from "bootstrap";

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

  // ▼▼ HP値をフォームから取得（name/id/cls どれでも拾う） ▼▼
  getHPFromForm(form) {
    const el =
      form.querySelector('[name="emotion_log[hp]"]') ||
      form.querySelector('[name="hp"]') ||
      form.querySelector("#hp") ||
      form.querySelector("#hp-input") ||
      form.querySelector(".js-hp-input");
    if (!el) return null;
    const v = Number(el.value);
    if (!Number.isFinite(v)) return null;
    return Math.min(100, Math.max(0, v));
  }

  // ▼▼ 送信直前に必ず localStorage を更新してバーも即反映 ▼▼
  saveHPBeforeFetch(form) {
    const hp = this.getHPFromForm(form);
    if (hp === null) {
      console.warn("⚠️ HP入力が見つからない/数値でない");
      return;
    }
    localStorage.setItem("hpPercentage", String(hp));
    if (window.updateHPBar) window.updateHPBar();
    console.log("💾 HP saved BEFORE fetch:", hp);
  }

  submit(event) {
    event.preventDefault();

    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("view-hidden");
    if (this.hasSubmitTarget) this.submitTarget.disabled = true;

    const form     = this.element;
    const formData = new FormData(form);

    // ★★★ ここが超重要：送信直前に保存＆反映 ★★★
    this.saveHPBeforeFetch(form);

    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
      credentials: "same-origin",
    })
      .then(async (res) => {
        let data = {};
        try { data = await res.json(); } catch {}

        if (res.ok && data.success) {
          // --- 成功時 ---
          Swal.fire({
            title: "成功 🎉",
            text: data.message,
            icon: "success",
            confirmButtonText: "OK",
            timer: 2000,
            timerProgressBar: true,
            background: "linear-gradient(135deg, #00b3ff, #ff0088)",
            color: "#fff",
            customClass: { popup: "cyber-popup" }
          });

          // 「プレイリスト作成フォームだけ」右上トースト
          if (form.id === "playlist-form") {
            const toastEl = document.getElementById("save-toast");
            if (toastEl) {
              const body = toastEl.querySelector(".toast-body");
              if (body) body.textContent = "プレイリストを作成しました！";
              bootstrap.Toast.getOrCreateInstance(toastEl).show();
            }
          }

          // ★ サーバ値での上書きはしない（フォーム値優先で固定） ★
          // 保険：リダイレクト前にもう一度フォーム値で確定
          const hp = this.getHPFromForm(form);
          if (hp !== null) {
            localStorage.setItem("hpPercentage", String(hp));
            if (window.updateHPBar) window.updateHPBar();
            console.log("🔁 force keep FORM HP before redirect:", hp);
          }

          // ================================
          // ★ 追加：フォームにHPが無い時だけ hpDelta(±) を加算
          // ================================
          const hpInput =
            form.querySelector('[name="emotion_log[hp]"]') ||
            form.querySelector('[name="hp"]') ||
            form.querySelector("#hp") ||
            form.querySelector("#hp-input") ||
            form.querySelector(".js-hp-input");

          if ((!hpInput || hpInput.value === "") &&
              typeof data.hpDelta !== "undefined" && data.hpDelta !== null) {
            const cur  = Math.min(100, Math.max(0, Number(localStorage.getItem("hpPercentage")) || 50));
            const next = Math.min(100, Math.max(0, cur + Number(data.hpDelta)));
            localStorage.setItem("hpPercentage", String(next));
            if (window.updateHPBar) window.updateHPBar();
            console.log("🧮 hpDelta applied:", data.hpDelta, "=>", next);
          } else if ((!hpInput || hpInput.value === "") &&
                     typeof data.hpPercentage !== "undefined" && data.hpPercentage !== null) {
            // 保険：割合が返ってきた場合（フォームHPが無いときのみ採用）
            const p = Math.min(100, Math.max(0, Number(data.hpPercentage)));
            if (Number.isFinite(p)) {
              localStorage.setItem("hpPercentage", String(p));
              if (window.updateHPBar) window.updateHPBar();
              console.log("✅ used server hpPercentage (fallback):", p);
            }
          }
          // ================================

          // HPバー反映／リダイレクト
          const redirect = () => { if (data.redirect_url) window.location.href = data.redirect_url; };
          if (data.hp_today) {
            setTimeout(redirect, 1500);
          } else {
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
          // --- バリデーションエラーなど失敗時 ---
          if (this.hasSubmitTarget) this.submitTarget.disabled = false;
          Swal.fire({
            title: "エラー ❌",
            text: (data.errors || []).join("\n") || "保存に失敗しました",
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
        if (this.hasSubmitTarget) this.submitTarget.disabled = false;
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
        if (loader) loader.classList.add("view-hidden");
        if (window.updateHPBar) window.updateHPBar();
        console.log("📦 localStorage.hpPercentage =", localStorage.getItem("hpPercentage"));
      });
  }
}
