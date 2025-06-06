// app/javascript/controllers/modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

document.addEventListener("turbo:before-stream-render", (event) => {
  const action = event.target.getAttribute("action")
  const target = event.target.getAttribute("target")

  // 「プレイリスト用」か「既存汎用」どちらかの枠が来たら処理
  if (
    (action === "remove" || action === "update" || action === "replace") &&
    (target === "modal-container" || target === "playlist-modal-container")
  ) {
    // まず、もし #playlist-modal があれば、Bootstrap で閉じる
    const playlistModalEl = document.getElementById("playlist-modal")
    if (playlistModalEl) {
      const bs = bootstrap.Modal.getInstance(playlistModalEl) || bootstrap.Modal.getOrCreateInstance(playlistModalEl)
      bs.hide()
    }

    // そのあとバックドロップだけを外す
    const arr = Array.from(document.querySelectorAll("body > .modal-backdrop"))
    const latest = arr[arr.length - 1]
    if (latest) latest.remove()

    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""
  }
})

export default class extends Controller {
 connect() {
  console.log("▶▶▶ generic modal controller connected")

  // ▼ ページロード時に残っているバックドロップを消す
  const arr = Array.from(document.querySelectorAll("body > .modal-backdrop"))
  const latest = arr[arr.length - 1]
  if (latest) latest.remove()
  document.body.classList.remove("modal-open")
  document.body.style.overflow = ""

  // ▼ ✅ このsetTimeoutで囲むのがポイント
  setTimeout(() => {
    const selectedLogContainer = this.element.querySelector("#selected-log-ids")
    if (selectedLogContainer) {
      selectedLogContainer.innerHTML = ""
      const checkedLogs = document.querySelectorAll("input.playlist-check:checked")
      if (checkedLogs.length === 0) {
        console.warn("⚠️ チェックされたログが見つかりません")
      }
      checkedLogs.forEach((checkbox) => {
        const hidden = document.createElement("input")
        hidden.type = "hidden"
        hidden.name = "selected_logs[]"
        hidden.value = checkbox.value
        selectedLogContainer.appendChild(hidden)
      })
    }
  }, 50) // ← ここでちょっと待つことで安定します

  // ▼ モーダルを表示
  const bsModal = bootstrap.Modal.getOrCreateInstance(this.element)
  bsModal.show()

  // ▼ モーダルが閉じられたら自分を DOM から削除
  this.element.addEventListener("hidden.bs.modal", () => {
    this.element.remove()
  })
}
}
