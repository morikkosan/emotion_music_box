// app/javascript/controllers/modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  connect() {
    console.log("▶▶▶ generic modal controller connected")

    // ▼ Bootstrap が最後に追加したバックドロップだけを消す
    const arr = Array.from(document.querySelectorAll('body > .modal-backdrop'));
    const latest = arr[arr.length - 1];
    if (latest) latest.remove();
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ""

    // ▼ モーダルを show させる
    const bsModal = bootstrap.Modal.getOrCreateInstance(this.element)
    bsModal.show()

    // ▼ モーダルが閉じられたら、自分自身を DOM から remove() して後片付け
    this.element.addEventListener('hidden.bs.modal', () => {
      this.element.remove()
    });
  }
}

// Turbo Stream で「modal-container」を更新するときにもバックドロップを最新の1つだけ消す
document.addEventListener("turbo:before-stream-render", (event) => {
  const action = event.target.getAttribute("action")
  const target = event.target.getAttribute("target")
  if ((action === "update" || action === "remove" || action === "replace") && target === "modal-container") {
    const arr = Array.from(document.querySelectorAll('body > .modal-backdrop'));
    const latest = arr[arr.length - 1];
    if (latest) latest.remove();
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ""
  }
})
