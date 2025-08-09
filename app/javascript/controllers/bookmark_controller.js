// app/javascript/controllers/bookmark_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["selectedLogsInput", "includeMyLogsCheckbox"]

  toggleMyPageLogs(event) {
    const el = event.target
    const form = el.form

    // モバイル判定
    const inMobileFrame = !!(
      document.getElementById("logs_list_mobile")?.contains(this.element) ||
      el.closest("turbo-frame#logs_list_mobile")
    )
    const isMobileForm =
      inMobileFrame ||
      (form && ["mobile-bookmarks-form", "mobile-search-form"].includes(form.id)) ||
      (form && form.getAttribute("data-turbo-frame") === "logs_list_mobile")

    if (isMobileForm) {
      event.preventDefault()
      event.stopPropagation()

      // ★ ここを form.action ではなく、必ずブクマ一覧に固定
      const url = new URL("/emotion_logs/bookmarks", window.location.origin)

      // 現在クエリをベースに
      const params = new URLSearchParams(window.location.search)

      // フォームがあればフォーム値もマージ（検索条件を維持）
      if (form) {
        for (const [k, v] of new FormData(form).entries()) {
          if (v !== null && v !== "") params.set(k, v)
        }
      }

      // チェックON/OFF反映
      if (el.checked) {
        params.set("include_my_logs", "true")
      } else {
        params.delete("include_my_logs")
      }

      // モバイル表示を強制
      params.set("view", "mobile")

      url.search = params.toString()

      // フレームだけ差し替え（フル遷移させない）
      const frame = document.getElementById("logs_list_mobile")
      if (frame) {
        frame.setAttribute("src", url.toString())
      } else if (window.Turbo?.visit) {
        Turbo.visit(url.toString(), { frame: "logs_list_mobile" })
      } else {
        window.location.href = url.toString()
      }
      return
    }

    // デスクトップ
    const base = new URL("/emotion_logs/bookmarks", window.location.origin)
    const cur  = new URLSearchParams(window.location.search)
    ;["genre","emotion","sort","period"].forEach(k => {
      const v = cur.get(k); if (v) base.searchParams.set(k, v)
    })
    if (el.checked) base.searchParams.set("include_my_logs", "true")
    // 未チェック時は param を付けずデフォルト（=含めない）
    window.Turbo?.visit ? Turbo.visit(base.toString(), { action: "advance" }) : (window.location.href = base.toString())
  }

  submitPlaylistForm() {
    const ids = Array.from(document.querySelectorAll(".playlist-check:checked")).map(b => b.value)
    if (this.hasSelectedLogsInputTarget) this.selectedLogsInputTarget.value = ids.join(",")
  }
}
