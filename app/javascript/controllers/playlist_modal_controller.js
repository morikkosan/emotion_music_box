// app/javascript/controllers/playlist_modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  connect() {
    // このコントローラがアタッチされた要素（= プレイリスト用の <div id="playlist-modal">）
    // に対してだけ動くようになっています。

    // ▼ もし以前のプレイリストモーダルが残っていれば消す
    document.querySelectorAll('#playlist-modal').forEach(el => el.remove())

    // ▼ もしバックドロップが残っていれば消す
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove())
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ""

    // ▼ Bootstrap の Modal インスタンスを作って show() を呼ぶ
    const bsModal = bootstrap.Modal.getOrCreateInstance(this.element)
    bsModal.show()
  }
}

// ────────────────────────────────────────────────────────────────
// Turbo Stream で modal-container を更新する前後に同じようにバックドロップを消す
// ※ これは共通処理でもいいですが、playlist_modal_controller に置いておいても問題ありません。
//   「modal-container」だけを監視するので、別のコントローラと干渉しません。
//────────────────────────────────────────────────────────────────
document.addEventListener("turbo:before-stream-render", (event) => {
  const action = event.target.getAttribute("action")
  const target = event.target.getAttribute("target")
  if ((action === "update" || action === "remove" || action === "replace") && target === "modal-container") {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove())
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ""
  }
})
