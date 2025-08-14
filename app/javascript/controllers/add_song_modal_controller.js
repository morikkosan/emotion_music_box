import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"
export default class extends Controller {
  static targets = ["item"]

  connect() {
    console.log("✅ add-song-modal connected")

    const modalEl = document.getElementById("addSongsModal")
    if (!modalEl) return

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl)

    // モーダル閉じたときにリロード
    modalEl.addEventListener("hidden.bs.modal", () => {
      console.log("🔁 モーダル閉じたのでページをリロードします")
      window.location.reload()
    })
  }

  hideItem(event) {
    const form = event.target.closest("form")
    const li = form.closest("li[data-add-song-modal-target='item']")
    if (li) li.remove()
  }
}
