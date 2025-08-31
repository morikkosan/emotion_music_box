// app/javascript/controllers/add_song_modal_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["item"]

  connect() {
    // ここでは何もしない（モーダル閉時のリロード等は一切しない）
    console.log("✅ add-song-modal connected")
  }

  // 送信開始時（任意のUX：連打防止）
  onSubmitStart(event) {
    const form = event.target
    const btn = form.querySelector("button[type='submit']")
    if (btn && !btn.dataset._locked) {
      btn.dataset._locked = "1"
      btn.dataset._orig = btn.innerHTML
      btn.disabled = true
      btn.textContent = "追加中..."
    }
  }

  // 送信完了（Turboが終わったら発火）
  onSubmitEnd(event) {
    const form = event.target

    // ボタン表示を元に戻す
    const btn = form.querySelector("button[type='submit']")
    if (btn) {
      btn.disabled = false
      btn.innerHTML = btn.dataset._orig || "追加"
      delete btn.dataset._locked
      delete btn.dataset._orig
    }

    // 失敗時は何もしない
    if (!event.detail || event.detail.success === false) return

    // 成功時：この候補行だけ消す（重複追加の防止）
    const li = form.closest("li[data-add-song-modal-target='item']")
    if (li) li.remove()

    // 🔸モーダルは閉じない／リロードもしない
    // プレイリスト側と候補リストは Turbo Stream で更新される想定
  }

  // 互換：ビューが `hideItem` を呼んでいる場合も同じ動作にする
  hideItem(event) {
    // turbo:submit-end と同じインターフェースで処理
    this.onSubmitEnd(event)
  }
}
