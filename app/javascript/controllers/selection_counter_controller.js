// app/javascript/controllers/selection_counter_controller.js
import { Controller } from "@hotwired/stimulus"

/*
<div
  data-controller="selection-counter"
  data-selection-counter-checkbox-selector-value=".playlist-check"
  data-selection-counter-button-selector-value=".bookmark-playlist-create-btn"
  data-selection-counter-namespace-key-value="bookmarks">  // ← 共有キー
  <span data-selection-counter-target="output" aria-live="polite">0個選択中</span>
  <!-- 任意: クリアボタン -->
  <button type="button" class="btn btn-sm btn-link ms-2"
          data-action="selection-counter#clearAll">選択クリア</button>
</div>
*/

export default class extends Controller {
  static targets = ["output"]
  static values = {
    checkboxSelector: String,
    buttonSelector: { type: String, default: "" },
    namespaceKey:   { type: String, default: "" }   // ← ページ/文脈のキー
  }

  connect() {
    this.handleChange     = this.handleChange.bind(this)
    this.onTurboLoad      = this.onTurboLoad.bind(this)
    this.onTurboFrameLoad = this.onTurboFrameLoad.bind(this)

    document.addEventListener("change", this.handleChange, true)
    document.addEventListener("turbo:load", this.onTurboLoad)
    document.addEventListener("turbo:frame-load", this.onTurboFrameLoad)

    this.mo = new MutationObserver(() => {
      clearTimeout(this._mutationTimer)
      this._mutationTimer = setTimeout(() => {
        this.applyCheckedState()
        this.updateCount()
      }, 50)
    })
    this.mo.observe(document.body, { childList: true, subtree: true })

    this.applyCheckedState()
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
    if (!e.target || !e.target.matches(sel)) return

    const id = String(e.target.value ?? e.target.dataset.id ?? "")
    if (!id) return

    const set = this._loadSet()
    if (e.target.checked) set.add(id)
    else set.delete(id)
    this._saveSet(set)
    this.updateCount()
  }

  onTurboLoad()      { this.applyCheckedState(); this.updateCount() }
  onTurboFrameLoad() { this.applyCheckedState(); this.updateCount() }

  // 任意: 全解除
  clearAll() {
    this._saveSet(new Set())
    const sel = this.checkboxSelectorValue || ".playlist-check"
    document.querySelectorAll(sel).forEach(cb => cb.checked = false)
    this.updateCount()
  }

  // 保存分を画面に反映（ページ移動・再描画時）
  applyCheckedState() {
    const sel = this.checkboxSelectorValue || ".playlist-check"
    const set = this._loadSet()
    document.querySelectorAll(sel).forEach(cb => {
      const id = String(cb.value ?? cb.dataset.id ?? "")
      if (id) cb.checked = set.has(id)
    })
  }

  updateCount() {
    const count = this._loadSet().size

    if (this.hasOutputTarget) {
      this.outputTarget.textContent = `${count}個選択中`
    }

    if (this.buttonSelectorValue) {
      const btn =
        this.element.querySelector(this.buttonSelectorValue) ||
        document.querySelector(this.buttonSelectorValue)
      if (btn) {
        if (count > 0) {
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

  // ===== sessionStorage =====
  _storageKey() {
    return this.namespaceKeyValue || `selection:${location.pathname}:bookmarks`
  }
  _loadSet() {
    try {
      const raw = sessionStorage.getItem(this._storageKey())
      if (!raw) return new Set()
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr.map(String) : [])
    } catch { return new Set() }
  }
  _saveSet(set) {
    try { sessionStorage.setItem(this._storageKey(), JSON.stringify([...set])) }
    catch { /* ignore */ }
  }
}
