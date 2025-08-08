import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

// 使い方：Turbo Streamで #modal-container に .modal を丸ごと update して差し込む。
// 閉じたら .modal は破棄するが、#modal-container は残す（次回の差し替え先にする）。
export default class extends Controller {
  connect() {
    // --- 前回の残骸を掃除（backdrop / bodyクラス） ---
    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""

    // 万が一、画面上に他の .modal.show が残っていたら閉じる
    document.querySelectorAll(".modal.show").forEach(m => {
      const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
      try { inst.hide(); inst.dispose() } catch (_) {}
      // 既存モーダルは消去（containerは残す方針）
      m.remove()
    })

    // --- Bootstrap モーダルを必ず生成・表示 ---
    this.bs = bootstrap.Modal.getOrCreateInstance(this.element) // this.element は .modal
    this.bs.show()

    // --- 任意：フォームのテキストエリアにフォーカス ---
    const desc = this.element.querySelector("#emotion_log_description")
    if (desc) {
      // レイアウト確定後にフォーカスさせる
      requestAnimationFrame(() => { try { desc.focus() } catch (_) {} })
    }

    // --- 閉じたら .modal だけ捨て、container は生かす ---
    this._onHidden = () => {
      try { this.bs?.dispose() } catch (_) {}
      // .modal（自分自身）を削除
      this.element.remove()

      // 念のため container の中身を空にする（container 自体は残す）
      const container = document.getElementById("modal-container")
      if (container) container.innerHTML = ""

      // 後片付け（backdrop / bodyクラス）
      document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
      document.body.classList.remove("modal-open")
      document.body.style.overflow = ""
    }
    this.element.addEventListener("hidden.bs.modal", this._onHidden, { once: true })
  }

  disconnect() {
    // StimulusがDOMから外れる際の保険
    try { this.bs?.dispose() } catch (_) {}
    this.element?.removeEventListener?.("hidden.bs.modal", this._onHidden)
  }
}

// --- Turboの描画前後での残骸掃除（安定化用）---
document.addEventListener("turbo:before-cache", () => {
  document.querySelectorAll(".modal.show").forEach(m => {
    const inst = bootstrap.Modal.getInstance(m)
    try { inst?.hide(); inst?.dispose() } catch (_) {}
    m.remove()
  })
  document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
  document.body.classList.remove("modal-open")
  document.body.style.overflow = ""
})

document.addEventListener("turbo:before-stream-render", (event) => {
  // Turbo Stream が #modal-container を remove/replace するときは、先に残骸を掃除
  const isTS = event.target.tagName === "TURBO-STREAM"
  if (!isTS) return
  const action = event.target.getAttribute("action")
  const target = event.target.getAttribute("target")
  if (["remove", "replace"].includes(action) && target === "modal-container") {
    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""
  }
})
