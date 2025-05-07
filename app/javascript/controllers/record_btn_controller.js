import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  hide() {
    this.element.classList.add("d-none")
  }

  connect() {
    document.addEventListener("hidden.bs.modal", () => {
      this.element.classList.remove("d-none")
    })
    document.addEventListener("turbo:load", () => {
      this.element.classList.remove("d-none")
    })
  }
}
