// app/javascript/controllers/soundcloud_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  open(event) {
    event.preventDefault()

    // Rails の OmniAuth ルートを popup モードで開く
    const popup = window.open(
      "/auth/soundcloud?display=popup",
      "soundcloud_popup",
      "width=600,height=700,left=100,top=100,scrollbars=yes"
    )

    // ポップアップが閉じられたら親をリロード
    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(interval)
        window.location.reload()
      }
    }, 500)
  }
}
