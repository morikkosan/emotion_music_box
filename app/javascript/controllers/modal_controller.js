// app/javascript/controllers/modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  connect() {
    console.log("✅ Stimulus modal_controller connected")
    const modal = bootstrap.Modal.getOrCreateInstance(this.element)
    modal.show()
  }
}