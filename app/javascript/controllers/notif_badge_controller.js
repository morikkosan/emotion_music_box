// app/javascript/controllers/notif_badge_controller.js
import { Controller } from "@hotwired/stimulus"

/**
 * 使い方（既に組み込み済みの想定）:
 * <div
 *   data-controller="notif-badge"
 *   data-notif-badge-endpoint-value="/notifications/unread_count.json"
 *   data-notif-badge-poll-interval-value="30000"
 *   data-notif-badge-modal-url-value="/notifications/modal.turbo_stream"
 *   data-action="click->notif-badge#openModal">
 *   <span class="notif-count-badge" data-notif-badge-target="badge" hidden>0</span>
 *   <a href="/notifications">通知数</a>
 * </div>
 */
export default class extends Controller {
  static targets = ["badge"]

  static values = {
    endpoint: String,
    pollInterval: { type: Number, default: 30000 },
    pauseOnHidden: { type: Boolean, default: true },

    // 任意：ヘッダメニューのクリック開閉（.is-open を付ける）
    menuWrapperSelector: String,
    menuButtonSelector: String,

    // ★ 追加: 通知モーダルのTurbo Stream URL & 受け皿ID
    modalUrl: String,
    modalContainerId: { type: String, default: "notifications-modal-container" }
  }

  connect() {
    // バージョン確認用ログ（キャッシュ混在検出）
    try { console.log("[notif-badge] connected, has openModal =", !!this.openModal) } catch(_) {}

    // ===== バッジ更新の初期化 =====
    this._boundRefresh = this.refresh.bind(this)
    this._boundOnVisibility = this.onVisibilityChange.bind(this)
    this._boundOnTurboLoad = this.onTurboLoad.bind(this)
    this._boundOnTurboFrameLoad = this.onTurboLoad.bind(this)

    window.addEventListener("notifications:refresh-badge", this._boundRefresh)
    document.addEventListener("visibilitychange", this._boundOnVisibility)
    window.addEventListener("turbo:load", this._boundOnTurboLoad)
    window.addEventListener("turbo:frame-load", this._boundOnTurboFrameLoad)

    this._inFlight = false
    this.update()
    this.startTimer()

    // ===== メニュー開閉（任意） =====
    this._menu = { wrapper: null, button: null, onDocClick: null, onKeydown: null, onButtonClick: null }
    this._setupMenuToggleIfProvided()
  }

  disconnect() {
    // バッジ関連
    window.removeEventListener("notifications:refresh-badge", this._boundRefresh)
    document.removeEventListener("visibilitychange", this._boundOnVisibility)
    window.removeEventListener("turbo:load", this._boundOnTurboLoad)
    window.removeEventListener("turbo:frame-load", this._boundOnTurboFrameLoad)
    this.clearTimer()

    // メニュー関連
    this._teardownMenuToggle()
  }

  // ===== タイマー制御 =====
  startTimer() {
    this.clearTimer()
    if (this.pollIntervalValue <= 0) return
    if (this.pauseOnHiddenValue && document.hidden) return
    this.timer = setInterval(() => this.update(), this.pollIntervalValue)
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  onVisibilityChange() {
    if (document.hidden) {
      if (this.pauseOnHiddenValue) this.clearTimer()
    } else {
      this.update()
      this.startTimer()
    }
  }

  onTurboLoad() {
    this.update()
  }

  // ===== 外部イベント/手動の更新要求 =====
  refresh() {
    this.update()
  }

  // ===== 件数取得 & レンダリング =====
  async update() {
    if (!this.endpointValue || typeof this.endpointValue !== "string") return
    if (this._inFlight) return

    this._inFlight = true
    try {
      const r = await fetch(this.endpointValue, {
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      const n = Number(j?.unread_count ?? 0)
      this.renderCount(Number.isFinite(n) ? n : 0)
    } catch (e) {
      this.renderCount(0)
      console.warn("[notif-badge] update failed:", e)
    } finally {
      this._inFlight = false
    }
  }

  renderCount(n) {
    if (!this.hasBadgeTarget) return
    const el = this.badgeTarget
    if (n > 0) {
      el.textContent = String(n)
      el.hidden = false
      el.setAttribute("aria-label", `未読通知 ${n}件`)
    } else {
      el.textContent = "0"
      el.hidden = true
      el.removeAttribute("aria-label")
    }
  }

  // ===== クリックで通知モーダルを確実に開く（Turboに依存しない） =====
  async openModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation() }

    const url = this.hasModalUrlValue ? this.modalUrlValue : null
    const targetId = this.modalContainerIdValue || "notifications-modal-container"
    const container = document.getElementById(targetId)

    if (!url || !container) {
      console.warn("[notif-badge] modal url or container missing", { url, targetId })
      return
    }

    // Turbo Stream を取得してそのまま適用
    let html = ""
    try {
      const r = await fetch(url, {
        credentials: "include",
        headers: { "Accept": "text/vnd.turbo-stream.html" },
        cache: "no-store"
      })
      html = await r.text()
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      if (window.Turbo?.renderStreamMessage) {
        window.Turbo.renderStreamMessage(html)
      } else {
        // 保険（通常は不要）：直接containerを書き換え
        container.innerHTML = html
      }
    } catch (e) {
      console.error("[notif-badge] fetch modal failed:", e, html)
      return
    }

    // 反映後に確実に開く（notif-page[role=modal]がshowするが二重保険）
    requestAnimationFrame(() => {
      const el = document.getElementById("notifications-modal")
      const Modal = window.bootstrap && window.bootstrap.Modal
      if (el && Modal) {
        const m = Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true })
        try { m.show() } catch (_) {}
      }
    })

    // ドロップダウンなどを閉じておく
    try {
      const dropdown = this.element.closest(".user-dropdown")
      if (dropdown) dropdown.querySelector(".dropdown-menu")?.classList?.remove("show")
      this.element.closest("#notif-menu-wrapper.is-open")?.classList?.remove("is-open")
    } catch (_) {}
  }

  // ===== メニュー開閉（任意・CSSでホバー無効化してある前提） =====
  _setupMenuToggleIfProvided() {
    const wrapSel = this.hasMenuWrapperSelectorValue ? this.menuWrapperSelectorValue : null
    const btnSel  = this.hasMenuButtonSelectorValue  ? this.menuButtonSelectorValue  : null
    if (!wrapSel || !btnSel) return

    const wrapper = document.querySelector(wrapSel)
    const button  = document.querySelector(btnSel)
    if (!wrapper || !button) return

    this._menu.wrapper = wrapper
    this._menu.button  = button

    this._menu.onButtonClick = (e) => {
      e?.preventDefault()
      e?.stopPropagation()
      wrapper.classList.toggle("is-open")
    }
    this._menu.onDocClick = (e) => {
      if (!wrapper.contains(e.target)) wrapper.classList.remove("is-open")
    }
    this._menu.onKeydown = (e) => {
      if (e.key === "Escape") wrapper.classList.remove("is-open")
    }

    button.addEventListener("click", this._menu.onButtonClick)
    document.addEventListener("click", this._menu.onDocClick)
    document.addEventListener("keydown", this._menu.onKeydown)
  }

  _teardownMenuToggle() {
    const { button, onButtonClick, onDocClick, onKeydown } = this._menu
    if (button && onButtonClick) button.removeEventListener("click", onButtonClick)
    if (onDocClick)  document.removeEventListener("click", onDocClick)
    if (onKeydown)   document.removeEventListener("keydown", onKeydown)
    this._menu = { wrapper: null, button: null, onDocClick: null, onKeydown: null, onButtonClick: null }
  }
}
