import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    commentId: Number,
    kind: String
  }

  static targets = ["button", "count"]

  toggle(event) {
    event.preventDefault()

    const btn    = this.buttonTarget
    const cntEl  = this.countTarget
    const kind   = this.kindValue
    let count    = parseInt(cntEl.textContent, 10)
    count = isNaN(count) ? 0 : count

    const outlineClass = kind === "sorena" ? "btn-outline-success" : "btn-outline-info"
    const solidClass   = kind === "sorena" ? "btn-success" : "btn-info"
    const isActive     = btn.classList.contains("active-reaction")

    // ✅ 1. クラス＆カウントを即時変更（ユーザー体感優先）
    btn.classList.remove("btn-success", "btn-info", "btn-outline-success", "btn-outline-info", "active-reaction")

    if (isActive) {
      count = Math.max(0, count - 1)
      btn.classList.add(outlineClass)
    } else {
      count += 1
      btn.classList.add(solidClass, "active-reaction")
    }

    // ✅ 2. カウントも即表示
    cntEl.textContent = count

    // ✅ 3. fetchは裏で処理（通信に遅延があっても見た目は変えない）
    fetch(`/comments/${this.commentIdValue}/toggle_reaction?kind=${kind}`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "X-CSRF-Token": document.querySelector("meta[name=csrf-token]").content,
      },
      credentials: "same-origin"
    })
      .then(response => response.json())
      .then(data => {
        if (data.status !== "ok") {
          console.error("リアクション失敗（応答エラー）")
        }
      })
      .catch(error => {
        console.error("通信エラー:", error)
      })
  }
}
