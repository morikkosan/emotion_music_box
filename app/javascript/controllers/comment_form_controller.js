// app/javascript/controllers/comment_form_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  /* ===== targets =====
     submit    -> <input type="submit">
     textarea  -> <textarea …>
     comments  -> コメント一覧を包む div（id="comments" にもフォールバック）
  ==================================== */
  static targets = ["submit", "textarea", "comments"]

  /** 送信開始時 */
  sending(event) {
    //console.log("[comment-form] sending:", event)
    this.showToast("送信中…")
    this.submitTarget.disabled = true           // 二重送信防止
  }

  /** 送信完了時（成功・失敗とも） */
  sent(event) {
    //console.log("[comment-form] sent detail:", event.detail)

    if (event.detail.success) {
      //console.log("[comment-form] -> success, Reset & Scroll")
      this.showToast("送信しました ✅", 1500)
      this.scrollToBottom()
      this.element.reset()                      // フォーム入力クリア
      this.textareaTarget.focus()
    } else {
      console.warn("[comment-form] -> failed")
      this.showToast("送信に失敗しました ❌", 3000)
    }

    this.submitTarget.disabled = false          // ボタン再有効化
  }

  /* ---------- helper ---------- */
  showToast(message, hideAfter = 0) {
    //console.log("[comment-form] showToast:", message)
    let toast = document.getElementById("comment-toast")

    if (!toast) {
      toast = document.createElement("div")
      toast.id = "comment-toast"
      toast.style.cssText =
  "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;" +  // ← 上げた
  "background:#333;color:#fff;padding:8px 16px;border-radius:8px;" +
  "box-shadow:0 4px 6px rgba(0,0,0,.3);transition:opacity .4s;text-align:center"


      document.body.appendChild(toast)
    }

    toast.textContent = message
    toast.style.opacity = 1

    if (hideAfter > 0) {
      setTimeout(() => {
        toast.style.opacity = 0
        //console.log("[comment-form] toast hidden")
      }, hideAfter)
    }
  }

  scrollToBottom() {
    const list = this.hasCommentsTarget ? this.commentsTarget
                                        : document.getElementById("comments")
    if (!list) {
      console.warn("[comment-form] #comments not found")
      return
    }
    //console.log("[comment-form] scrollToBottom →", list.scrollHeight)
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" })
  }
}
