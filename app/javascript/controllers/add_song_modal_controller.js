// app/javascript/controllers/add_song_modal_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["item"]

  // 曲が追加されたあとに呼ばれる
  hideItem(event) {
    // submit した form の親の <li> 要素を削除
    const form = event.target.closest("form")
    const li   = form.closest("li[data-add-song-modal-target='item']")
    if (li) li.remove()
  }

  // 閉じるボタンを押したあとにページを再読み込み
  reloadPage() {
    window.location.reload()
  }
}
