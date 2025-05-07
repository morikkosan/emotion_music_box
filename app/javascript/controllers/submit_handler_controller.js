// app/javascript/controllers/submit_handler_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect () {
    console.log("📝 submit-handler connected")
  }

  submit (event) {
    event.preventDefault()

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
          /* ------------------------------------------ */
          return
        }
        alert("保存に失敗しました: " + (data.errors || []).join("\\n"))
      })
      .catch(error => {
        console.error("送信エラー:", error)
        alert("予期しないエラーが発生しました")
      })
  }
}
