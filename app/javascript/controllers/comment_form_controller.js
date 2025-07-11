// app/javascript/controllers/comment_form_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["submit", "textarea", "comments"]

  sending(event) {
    this.showToast("送信中…")
    this.submitTarget.disabled = true
  }

  sent(event) {
    if (event.detail.success) {
      this.showToast("送信しました ✅", 1500)
      this.scrollToBottom()
      this.element.reset()
      this.textareaTarget.focus()
    } else {
      this.showToast("送信に失敗しました ❌", 3000)
    }
    this.submitTarget.disabled = false
  }

  /* ---------- helper ---------- */
  showToast(message, hideAfter = 0) {
    let toast = document.getElementById("comment-toast")

    if (!toast) {
      toast = document.createElement("div")
      toast.id = "comment-toast"
      toast.className = "comment-toast"   // ← クラスを付与（CSSでスタイル）
      document.body.appendChild(toast)
    }

    toast.textContent = message
    toast.classList.add("visible")  // ← 表示用クラスを追加

    if (hideAfter > 0) {
      setTimeout(() => {
        toast.classList.remove("visible")  // ← 非表示クラスでフェードアウト
      }, hideAfter)
    }
  }

  scrollToBottom() {
    const list = this.hasCommentsTarget ? this.commentsTarget
                                        : document.getElementById("comments")
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" })
  }
}
