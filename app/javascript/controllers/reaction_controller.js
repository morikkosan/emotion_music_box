// app/javascript/controllers/reaction_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    commentId: Number,
    kind: String
  }
  static targets = [ "button", "count" ]

  toggle(event) {
    event.preventDefault()
    const btn   = this.buttonTarget
    const cntEl = this.countTarget
    let   cnt   = parseInt(cntEl.textContent, 10)

    // トグル前の状態
    const isActive = btn.classList.contains("btn-primary")

    // 見た目を即更新
    if (isActive) {
      cnt -= 1
      btn.classList.replace("btn-primary", "btn-outline-secondary")
    } else {
      cnt += 1
      btn.classList.replace("btn-outline-secondary", "btn-primary")
    }
    cntEl.textContent = cnt

    // サーバー通知だけ（JSONレスポンス期待しない）
    fetch(`/comments/${this.commentIdValue}/toggle_reaction?kind=${this.kindValue}`, {
      method: "POST",
      headers: {
        "Accept":        "application/json",
        "X-CSRF-Token":  document.querySelector("meta[name=csrf-token]").content
      },
      credentials: "same-origin"
    })
  }
}
