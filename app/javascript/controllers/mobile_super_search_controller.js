// Stimulusコントローラ例
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  open() {
    const modal = document.getElementById("mobile-super-search-modal")
    bootstrap.Modal.getOrCreateInstance(modal).show()
  }
}
