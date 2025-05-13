// app/javascript/controllers/submit_handler_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  // ① submit ボタンをターゲットにする
  static targets = ["submit"]

  connect () {
    console.log("📝 submit-handler connected")
    // フォーム表示時に必ず有効化
    if (this.hasSubmitTarget) {
      this.submitTarget.disabled = false
    }
  }

  submit (event) {
    event.preventDefault()

    // ② 送信時にボタンを無効化（二度押し防止）
    if (this.hasSubmitTarget) {
      this.submitTarget.disabled = true
    }

    const form     = this.element
    const formData = new FormData(form)

    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          /* --- ① トースト表示 ----------------------- */
          const toastEl = document.getElementById("save-toast")
          if (toastEl) {
            const toast = bootstrap.Toast.getOrCreateInstance(toastEl)
            toast.show()
          }
          /* --- ② 1.5 秒後にリダイレクト -------------- */
          setTimeout(() => {
            window.location.href = data.redirect_url
          }, 1500)
          return
        }
        // ③ エラー時はボタンを再有効化
        if (this.hasSubmitTarget) {
          this.submitTarget.disabled = false
        }
        alert("保存に失敗しました: " + (data.errors || []).join("\n"))
      })
      .catch(error => {
        console.error("送信エラー:", error)
        // ④ 想定外エラーでも再有効化
        if (this.hasSubmitTarget) {
          this.submitTarget.disabled = false
        }
        alert("予期しないエラーが発生しました")
      })
  }
}
