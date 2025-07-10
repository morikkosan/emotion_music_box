// app/javascript/controllers/redirect_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    setTimeout(() => {
      window.location.href = this.data.get("url");
    }, 1200);
  }
}
