// app/javascript/controllers/modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

// 使い方：Turbo Streamで #modal-container に .modal を差し込む。
// 閉じたら .modal は破棄するが、#modal-container は残す。
export default class extends Controller {
  connect() {
    // --- 軽い掃除（backdrop / bodyクラス）---
    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""

    // --- 既存の開いてるモーダルがあれば、安全に閉じる（※ hidden 待ち！）---
    document.querySelectorAll(".modal.show").forEach(m => {
      const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
      m.addEventListener("hidden.bs.modal", () => {
        try { inst.dispose() } catch (_) {}
        m.remove()
        // 念のため
        document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
        document.body.classList.remove("modal-open")
        document.body.style.overflow = ""
      }, { once: true })
      inst.hide() // ← dispose は hidden 後にやる
    })

    // --- このモーダルを生成・表示 ---
    this.bs = bootstrap.Modal.getOrCreateInstance(this.element)
    this.bs.show()

    // 任意: 入力にフォーカス
    const desc = this.element.querySelector("#emotion_log_description")
    if (desc) requestAnimationFrame(() => { try { desc.focus() } catch (_) {} })

    // --- このモーダルが閉じられたら破棄＆片付け ---
    this._onHidden = () => {
      try { this.bs?.dispose() } catch (_) {}
      this.element.remove()

      const container = document.getElementById("modal-container")
      if (container) container.innerHTML = ""

      document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
      document.body.classList.remove("modal-open")
      document.body.style.overflow = ""
    }
    this.element.addEventListener("hidden.bs.modal", this._onHidden, { once: true })
  }

  disconnect() {
    try { this.bs?.dispose() } catch (_) {}
    this.element?.removeEventListener?.("hidden.bs.modal", this._onHidden)
  }
}

// --- Turbo のライフサイクルでの掃除（hidden を待つ版）---
document.addEventListener("turbo:before-cache", () => {
  document.querySelectorAll(".modal.show").forEach(m => {
    const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
    m.addEventListener("hidden.bs.modal", () => {
      try { inst.dispose() } catch (_) {}
      m.remove()
    }, { once: true })
    inst.hide()
  })
  document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
  document.body.classList.remove("modal-open")
  document.body.style.overflow = ""
})

document.addEventListener("turbo:before-stream-render", (event) => {
  const isTS = event.target.tagName === "TURBO-STREAM"
  if (!isTS) return
  const action = event.target.getAttribute("action")
  const target = event.target.getAttribute("target")

  // #modal-container を replace/remove する直前は、開いてるモーダルを安全に閉じる
  if (["remove", "replace"].includes(action) && target === "modal-container") {
    document.querySelectorAll(".modal.show").forEach(m => {
      const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
      m.addEventListener("hidden.bs.modal", () => {
        try { inst.dispose() } catch (_) {}
        m.remove()
      }, { once: true })
      inst.hide()
    })
  }
})
