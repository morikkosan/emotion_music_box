// app/javascript/controllers/comment_update_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    setTimeout(() => {
      this.element.innerHTML = "";
    }, 2000);
  }
}
