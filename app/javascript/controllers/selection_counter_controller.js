// app/javascript/controllers/selection_counter_controller.js
import { Controller } from "@hotwired/stimulus"

/*
  HTML:
  <div
    data-controller="selection-counter"
    data-selection-counter-checkbox-selector-value=".playlist-check"
    data-selection-counter-button-selector-value=".bookmark-playlist-create-btn">
    <span data-selection-counter-target="output" aria-live="polite">0個選択中</span>
  </div>
*/

export default class extends Controller {
  static targets = ["output"]
  static values = {
    checkboxSelector: String,
    buttonSelector: { type: String, default: "" }
  }

  connect() {
    this.handleChange     = this.handleChange.bind(this)
    this.onTurboLoad      = this.onTurboLoad.bind(this)
    this.onTurboFrameLoad = this.onTurboFrameLoad.bind(this)

    // 変更はドキュメント全体で拾う（フレーム跨ぎでもOKにする）
    document.addEventListener("change", this.handleChange, true)
    document.addEventListener("turbo:load", this.onTurboLoad)
    document.addEventListener("turbo:frame-load", this.onTurboFrameLoad)

    // 大きなDOM変化にも追従（全体監視）
    this.mo = new MutationObserver(() => {
      clearTimeout(this._mutationTimer)
      this._mutationTimer = setTimeout(() => this.updateCount(), 50)
    })
    this.mo.observe(document.body, { childList: true, subtree: true })

    this.updateCount()
  }

  disconnect() {
    document.removeEventListener("change", this.handleChange, true)
    document.removeEventListener("turbo:load", this.onTurboLoad)
    document.removeEventListener("turbo:frame-load", this.onTurboFrameLoad)
    if (this.mo) this.mo.disconnect()
    clearTimeout(this._mutationTimer)
  }

  handleChange(e) {
    const sel = this.checkboxSelectorValue || ".playlist-check"
    if (e.target && e.target.matches(sel)) {
      this.updateCount()
    }
  }

  onTurboLoad()      { this.updateCount() }
  onTurboFrameLoad() { this.updateCount() }

  updateCount() {
    const sel = this.checkboxSelectorValue || ".playlist-check"

    // ★ 重要：常に document から集計（どのフレームにいても拾える）
    const boxes   = Array.from(document.querySelectorAll(sel))
    const checked = boxes.filter(b => b.checked).length

    if (this.hasOutputTarget) {
      this.outputTarget.textContent = `${checked}個選択中`
    }

    if (this.buttonSelectorValue) {
      // まずは自身の要素内→無ければdocument
      const btn =
        this.element.querySelector(this.buttonSelectorValue) ||
        document.querySelector(this.buttonSelectorValue)

      if (btn) {
        if (checked > 0) {
          btn.removeAttribute("disabled")
          btn.classList.remove("disabled")
          btn.setAttribute("aria-disabled", "false")
        } else {
          btn.setAttribute("disabled", "disabled")
          btn.classList.add("disabled")
          btn.setAttribute("aria-disabled", "true")
        }
      }
    }
  }
}
