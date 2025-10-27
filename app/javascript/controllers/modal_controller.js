// app/javascript/controllers/modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

// 使い方：Turbo Streamで #modal-container に .modal を差し込む。
// 閉じたら .modal は破棄するが、#modal-container は残す。
export default class extends Controller {
  connect() {
    // --- まず軽い掃除（残存 backdrop / body クラス）---
    try {
      document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
      document.body.classList.remove("modal-open")
      document.body.style.overflow = ""
    } catch (_) {}

    // --- 既に開いているモーダルがあれば安全に閉じる（hidden 待ちで dispose / remove）---
    try {
      document.querySelectorAll(".modal.show").forEach(m => {
        const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
        m.addEventListener("hidden.bs.modal", () => {
          try { inst.dispose() } catch (_) {}
          try { m.remove() } catch (_) {}
          // 念のためもう一度掃除
          try {
            document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
            document.body.classList.remove("modal-open")
            document.body.style.overflow = ""
          } catch (_) {}
        }, { once: true })
        inst.hide() // dispose は hidden 後
      })
    } catch (_) {}

    // --- このモーダルを生成・表示 ---
    this.bs = bootstrap.Modal.getOrCreateInstance(this.element)
    this.bs.show()

    // 任意: 入力にフォーカス（存在すれば）
    const desc = this.element.querySelector("#emotion_log_description")
    if (desc) requestAnimationFrame(() => { try { desc.focus() } catch (_) {} })

    // --- このモーダルが閉じられたら破棄＆片付け ---
    this._onHidden = () => {
      try { this.bs?.dispose() } catch (_) {}
      try { this.element.remove() } catch (_) {}

      const container = document.getElementById("modal-container")
      if (container) container.innerHTML = ""

      // 念のため掃除
      try {
        document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
        document.body.classList.remove("modal-open")
        document.body.style.overflow = ""
      } catch (_) {}
    }
    this.element.addEventListener("hidden.bs.modal", this._onHidden, { once: true })
  }

  disconnect() {
    try { this.bs?.dispose() } catch (_) {}
    try { this.element?.removeEventListener?.("hidden.bs.modal", this._onHidden) } catch (_) {}
  }
}

// --- Turbo のライフサイクルでの掃除（hidden を待つ版）---
document.addEventListener("turbo:before-cache", () => {
  try {
    document.querySelectorAll(".modal.show").forEach(m => {
      const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
      m.addEventListener("hidden.bs.modal", () => {
        try { inst.dispose() } catch (_) {}
        try { m.remove() } catch (_) {}
      }, { once: true })
      inst.hide()
    })
    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""
  } catch (_) {}
})

// Turbo Stream で #modal-container を replace/remove する直前は、開いてるモーダルを安全に閉じる
document.addEventListener("turbo:before-stream-render", (event) => {
  const isTS = event.target?.tagName === "TURBO-STREAM"
  if (!isTS) return

  const action = event.target.getAttribute("action")
  const target = event.target.getAttribute("target")

  if (["remove", "replace"].includes(action) && target === "modal-container") {
    try {
      document.querySelectorAll(".modal.show").forEach(m => {
        const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
        m.addEventListener("hidden.bs.modal", () => {
          try { inst.dispose() } catch (_) {}
          try { m.remove() } catch (_) {}
        }, { once: true })
        inst.hide()
      })
    } catch (_) {}

    
  }
  
})


// ---- グローバル: ログイン要求イベントを拾ってモーダルを出す（既存と非干渉）----
(function setupLoginRequiredListener() {
  if (window.__loginListenerInstalled) return;
  window.__loginListenerInstalled = true;

  window.addEventListener("app:login-required", async (ev) => {
    // すでに他のモーダルが開いていたら何もしない（干渉しない）
    if (document.querySelector(".modal.show")) return;

    // 1) 既存の #login-modal がDOMにあれば、それを開く
    const existing = document.getElementById("login-modal");
    if (existing) {
      const inst = bootstrap.Modal.getOrCreateInstance(existing);
      inst.show();
      return;
    }

    // 2) サーバからログイン用モーダルを取って #modal-container に差し込む
    const container = document.getElementById("modal-container");
    const url = ev?.detail?.url || "/session/login_modal"; // ←あなたのルートに合わせて変更

    if (!container) return;

    try {
      const res = await fetch(url, {
        headers: { "Accept": "text/vnd.turbo-stream.html, text/html" },
        credentials: "same-origin"
      });
      const html = await res.text();

      if (html.includes("<turbo-stream")) {
        // Turbo Streamで返す場合
        if (window.Turbo && Turbo.renderStreamMessage) {
          Turbo.renderStreamMessage(html);
        } else {
          document.documentElement.insertAdjacentHTML("beforeend", html);
        }
      } else {
        // 素のHTMLで返す場合：#modal-container に差し込む
        // 挿入される .modal に data-controller="modal" が付いていれば connect() で自動 show
        container.innerHTML = html;
      }
    } catch (e) {
      // フォールバック：失敗時はログインページへ遷移
      location.href = "/users/sign_in";
    }
  });
})();

