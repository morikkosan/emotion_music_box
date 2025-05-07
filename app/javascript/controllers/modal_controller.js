// app/javascript/controllers/modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  connect () {
    console.log("🟢 modal_controller connected")

    // ------- モーダルの重複排除 -------
    const modals = document.querySelectorAll("#modal-container")
    if (modals.length > 1) {
      modals.forEach((el, idx) => { if (idx < modals.length - 1) el.remove() })
    }

    // ------- Bootstrap モーダルを必ず表示 -------
    const bsModal = bootstrap.Modal.getOrCreateInstance(this.element)
    bsModal.show()

    // ------- description にフォーカス（任意）-------
    const desc = this.element.querySelector("#emotion_log_description")
    if (desc) setTimeout(() => desc.focus(), 100)
  }
}
