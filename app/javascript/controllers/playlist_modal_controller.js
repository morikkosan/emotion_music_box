import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

document.addEventListener("turbo:before-stream-render", (event) => {
  const action = event.target.getAttribute("action");
  const target = event.target.getAttribute("target");

  if ((action === "remove" || action === "update" || action === "replace") && target === "modal-container") {
    const arr = Array.from(document.querySelectorAll('body > .modal-backdrop'));
    const latest = arr[arr.length - 1];
    if (latest) latest.remove();
    document.body.classList.remove('modal-open');
    document.body.style.overflow = "";
  }
});

export default class extends Controller {
  connect() {
    console.log("▶▶▶ generic modal controller connected")

    // ▼ バックドロップ処理
    const arr = Array.from(document.querySelectorAll('body > .modal-backdrop'));
    const latest = arr[arr.length - 1];
    if (latest) latest.remove();
    document.body.classList.remove('modal-open')
    document.body.style.overflow = ""

    // ▼ チェック済みのログIDを hidden input に変換してモーダル内に挿入
    const selectedLogContainer = this.element.querySelector("#selected-log-ids")
    if (selectedLogContainer) {
      selectedLogContainer.innerHTML = ""
      const checkedLogs = document.querySelectorAll("input.playlist-check:checked")
      checkedLogs.forEach((checkbox) => {
        const hidden = document.createElement("input")
        hidden.type = "hidden"
        hidden.name = "selected_logs[]"
        hidden.value = checkbox.value
        selectedLogContainer.appendChild(hidden)
      })
    }

    // ▼ モーダルを表示
    const bsModal = bootstrap.Modal.getOrCreateInstance(this.element)
    bsModal.show()

    // ▼ モーダルが閉じられたら自分をDOMから削除
    this.element.addEventListener('hidden.bs.modal', () => {
      this.element.remove()
    });
  }
}
