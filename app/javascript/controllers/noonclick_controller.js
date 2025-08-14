// controllers/noonclick_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  goToRecommended() {
    // 具体的な処理を書く（例: window.location.href = "/recommended";）
    window.location.href = "/recommended";
  }
  closeWindow() {
    window.close();
  }

  confirmDelete(event) {
  if (!window.confirm('本当にこのプレイリストを削除しますか？')) {
    event.preventDefault();
    event.stopPropagation();
  }
}
}


