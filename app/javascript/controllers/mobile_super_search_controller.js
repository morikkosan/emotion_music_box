// app/javascript/controllers/mobile_super_search_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  static values = {
    modalId: { type: String, default: "mobile-super-search-modal" }
  }

  // ---- ユーティリティ ----
  get modalEl() {
    return document.getElementById(this.modalIdValue)
  }
  get modal() {
    if (!this.modalEl) return null
    return bootstrap.Modal.getOrCreateInstance(this.modalEl)
  }

  // ---- イベントハンドラ ----
  open(event) {
    if (event) event.preventDefault()
    this.modal?.show()
  }

  // Turboで送信が始まったらモーダルを閉じる（フォーカス/再描画の競合を回避）
  beforeSubmit() {
    this.modal?.hide()
    // 送信ボタンを念のため無効化（多重送信防止）
    const submit = this.modalEl?.querySelector('[data-role="mobile-search-submit"]')
    if (submit) submit.disabled = true
  }

  // 送信完了後にボタンを戻す（失敗時もここに来る）
  afterSubmit() {
    const submit = this.modalEl?.querySelector('[data-role="mobile-search-submit"]')
    if (submit) submit.disabled = false
  }
}
