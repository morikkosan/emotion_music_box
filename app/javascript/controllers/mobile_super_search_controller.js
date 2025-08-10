import { Controller } from "@hotwired/stimulus"
import { Modal } from "bootstrap"

export default class extends Controller {
  static values = { modalId: String }

  connect() {
    this._isModal = this.element.classList.contains("modal")
    this._transitioning = false
    this._closing = false

    this._onShown  = () => { this._transitioning = false; this._closing = false }
    this._onHidden = () => { this._transitioning = false; this._closing = false; this._scrub() }

    this._beforeCache  = () => this._hideIfExists()
    this._beforeRender = () => this._hideIfExists()

    if (this._isModal) {
      this.modal = Modal.getOrCreateInstance(this.element, { backdrop: true, keyboard: true, focus: true })
      this.element.addEventListener("shown.bs.modal", this._onShown)
      this.element.addEventListener("hidden.bs.modal", this._onHidden)

      // ← ドキュメントイベントはモーダル側のインスタンスだけが持つ
      document.addEventListener("turbo:before-cache", this._beforeCache)
      document.addEventListener("turbo:before-render", this._beforeRender)
    }
  }

  disconnect() {
    if (this._isModal) {
      this.element.removeEventListener("shown.bs.modal", this._onShown)
      this.element.removeEventListener("hidden.bs.modal", this._onHidden)
      document.removeEventListener("turbo:before-cache", this._beforeCache)
      document.removeEventListener("turbo:before-render", this._beforeRender)
      // 重要：disposeしない（hide中に _element が null になって例外化するため）
      // try { this.modal?.dispose() } catch {}
    }
  }

  // どのボタンからでも
  open(e) {
    e?.preventDefault()
    const el = this._modalEl()
    if (!el) return
    this._scrub()
    const inst = Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true, focus: true })
    this._transitioning = true
    el.addEventListener("shown.bs.modal", this._onShown)
    el.addEventListener("hidden.bs.modal", this._onHidden)
    inst.show()
  }

  close(e) {
    e?.preventDefault()
    this._hideIfExists()
  }

  beforeSubmit() {
    this._hideIfExists()
    const btn = this._modalEl()?.querySelector('[data-role="mobile-search-submit"]')
    if (btn) btn.disabled = true
  }

  afterSubmit() {
    const btn = this._modalEl()?.querySelector('[data-role="mobile-search-submit"]')
    if (btn) btn.disabled = false
  }

  // ---- 内部 ----
  _hideIfExists() {
    const el = this._modalEl()
    if (!el || this._closing) return
    const inst = Modal.getInstance(el) || Modal.getOrCreateInstance(el)
    this._closing = true
    try { inst.hide() } catch {}
  }

  _modalEl() {
    if (this._isModal) return this.element
    if (this.hasModalIdValue) return document.getElementById(this.modalIdValue)
    const sel = this.element.getAttribute("data-bs-target") || this.element.getAttribute("data-target")
    return sel ? document.querySelector(sel) : null
  }

  _scrub() {
    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.removeProperty("overflow")
    document.body.style.removeProperty("padding-right")
  }
}
