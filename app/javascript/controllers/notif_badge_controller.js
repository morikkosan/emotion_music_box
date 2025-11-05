// app/javascript/controllers/notif_badge_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap" // window には依存しない

/**
 * 使い方（例）
 * <button
 *   id="notif-button"
 *   type="button"
 *   data-controller="notif-badge"
 *   data-notif-badge-endpoint-value="/notifications/unread_count.json"
 *   data-notif-badge-poll-interval-value="30000"
 *   data-notif-badge-modal-url-value="/notifications/modal.turbo_stream"
 *   data-notif-badge-modal-container-id-value="notifications-modal-container">
 *   通知
 *   <span class="notif-count-badge" data-notif-badge-target="badge" hidden>0</span>
 * </button>
 */
export default class extends Controller {
  static targets = ["badge"]

  static values = {
    endpoint: String,
    pollInterval: { type: Number, default: 30000 },
    pauseOnHidden: { type: Boolean, default: true },

    // 任意：ヘッダメニュー開閉
    menuWrapperSelector: String,
    menuButtonSelector: String,

    // 通知モーダル（汎用 #modal-container とは完全分離）
    modalUrl: String,
    modalContainerId: { type: String, default: "notifications-modal-container" },

    // z-index 調整（必要ならボタン側で上書き可能）
    modalZ:       { type: Number, default: 1000000 },
    backdropZ:    { type: Number, default: 999995 },
    demoteBelowZ: { type: Number, default: 999994 }
  }

  connect() {
    window.__notif = this // debug hook
    try { console.log("[notif-badge] connect:", this.element) } catch {}

    // クリック/Enter/Spaceで開く
    this._boundOpen = (e) => {
      const t = e.type
      const ok = (t === "click") || (t === "keydown" && (e.key === "Enter" || e.key === " "))
      if (!ok) return
      e.preventDefault(); e.stopPropagation()
      this.openModal()
    }
    this.element.addEventListener("click", this._boundOpen)
    this.element.addEventListener("keydown", this._boundOpen)

    // バッジ更新
    this._boundRefresh      = this.refresh.bind(this)
    this._boundOnVisibility = this.onVisibilityChange.bind(this)
    this._boundOnTurboLoad  = this.onTurboLoad.bind(this)
    this._boundOnFrameLoad  = this.onTurboLoad.bind(this)

    window.addEventListener("notifications:refresh-badge", this._boundRefresh)
    document.addEventListener("visibilitychange", this._boundOnVisibility)
    window.addEventListener("turbo:load", this._boundOnTurboLoad)
    window.addEventListener("turbo:frame-load", this._boundOnFrameLoad)

    // 通知専用モーダルだけナビ前/復帰でクローズ（汎用は触らない）
    this._boundHideSelf = this._hideNotificationsModalSafely.bind(this)
    document.addEventListener("turbo:before-render", this._boundHideSelf)
    document.addEventListener("turbo:before-cache",  this._boundHideSelf)
    document.addEventListener("turbo:visit",         this._boundHideSelf)
    window.addEventListener("pageshow", (e) => { if (e.persisted) this._hideNotificationsModalSafely() })

    this._inFlight = false
    this._opening  = false

    this.update()
    this.startTimer()

    // 任意：メニュー開閉
    this._menu = { wrapper: null, button: null, onDocClick: null, onKeydown: null, onButtonClick: null }
    this._setupMenuToggleIfProvided()
  }

  disconnect() {
    this.element.removeEventListener("click", this._boundOpen)
    this.element.removeEventListener("keydown", this._boundOpen)
    window.removeEventListener("notifications:refresh-badge", this._boundRefresh)
    document.removeEventListener("visibilitychange", this._boundOnVisibility)
    window.removeEventListener("turbo:load", this._boundOnTurboLoad)
    window.removeEventListener("turbo:frame-load", this._boundOnFrameLoad)

    document.removeEventListener("turbo:before-render", this._boundHideSelf)
    document.removeEventListener("turbo:before-cache",  this._boundHideSelf)
    document.removeEventListener("turbo:visit",         this._boundHideSelf)

    this.clearTimer()
    this._teardownMenuToggle()
  }

  // ===== タイマー =====
  startTimer() {
    this.clearTimer()
    if (this.pollIntervalValue <= 0) return
    if (this.pauseOnHiddenValue && document.hidden) return
    this.timer = setInterval(() => this.update(), this.pollIntervalValue)
  }
  clearTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null } }

  onVisibilityChange() {
    if (document.hidden) {
      if (this.pauseOnHiddenValue) this.clearTimer()
    } else {
      this.update()
      this.startTimer()
    }
  }
  onTurboLoad() { this.update() }
  refresh()     { this.update() }

  // ===== バッジ更新 =====
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

  // ===== 開く（通知専用。汎用 #modal-container とは完全分離） =====
  async openModal() {
    if (this._opening) return
    this._opening = true

    try {
      // すでに表示中の通知モーダルがあれば再利用
      const already = document.getElementById("notifications-modal")
      if (already && already.classList.contains("show")) {
        const reuseInst = bootstrap.Modal.getOrCreateInstance(already, { backdrop: true, keyboard: true, focus: false })
        reuseInst.show()
        this._opening = false
        return
      }

      // 1) ほかの .modal.show があれば hide() だけ（dispose/remove はしない）
      await this._hideAnyOpenModals()

      // 2) 受け皿（#notifications-modal-container）を <body> 直下に確保
      const targetId = this.modalContainerIdValue || "notifications-modal-container"
      let container = document.getElementById(targetId)
      if (!container) {
        container = document.createElement("div")
        container.id = targetId
        // 念のためスタックコンテキストを作らない値に固定
        container.style.position = "static"
        container.style.zIndex = "auto"
        document.body.appendChild(container)
        try { console.log("[notif-badge] create container:", targetId) } catch {}
      }

      // 3) Turbo Stream/HTML を取得して差し込み
      const url = this.hasModalUrlValue ? this.modalUrlValue : null
      if (!url) throw new Error("modal url missing")

      const r = await fetch(url, {
        credentials: "include",
        headers: { "Accept": "text/vnd.turbo-stream.html, text/html;q=0.9" },
        cache: "no-store"
      })
      const html = await r.text()
      if (!r.ok) throw new Error(`HTTP ${r.status}`)

      const isStream = /<\s*turbo-stream[\s>]/i.test(html)
      if (isStream && window.Turbo?.renderStreamMessage) {
        window.Turbo.renderStreamMessage(html)
      } else {
        container.innerHTML = html
      }

      // 4) #notifications-modal 出現を待ってから処理
      let modalEl = await this._waitForElementOrMutation("#notifications-modal", container, 5000)
      if (!modalEl) throw new Error("notifications-modal not found after render")

      // 4-α) 必ず body 直下へ移設（親の transform/position/z-index 影響を断つ）
      if (modalEl.parentElement !== document.body) {
        try {
          document.body.appendChild(modalEl)
          try { console.log("[notif-badge] moved modal into <body>") } catch {}
        } catch {}
      }

      // stray テキストノード（例: "flex"）が混入していれば除去
      try {
        const last = modalEl.lastChild
        if (last && last.nodeType === Node.TEXT_NODE && /\bflex\b/i.test(last.textContent || "")) {
          last.parentNode && last.parentNode.removeChild(last)
        }
      } catch {}

      // フォーカス先の用意
      try { modalEl.querySelector(".modal-dialog")?.setAttribute("tabindex", "-1") } catch {}

      // z-index をブースト
      try { modalEl.style.zIndex = String(this.modalZValue) } catch {}

      // 5) Bootstrap Modal（通知専用は focus:false で開く → null.focus を回避）
      const inst = bootstrap.Modal.getOrCreateInstance(modalEl, {
        backdrop: true,
        keyboard: true,
        focus: false
      })
      inst.show()

      // 次フレームで backdrop の z-index 調整＆邪魔な固定要素を一時降格
      requestAnimationFrame(() => {
        try {
          const bd = document.querySelector(".modal-backdrop")
          if (bd) {
            bd.style.zIndex = String(this.backdropZValue)
            // backdrop を body 直下に確実に配置（順序逆転の保険）
            if (bd.parentElement !== document.body) document.body.appendChild(bd)
          }
        } catch {}
        try {
          const cover = document.getElementById("screen-cover-loading")
          if (cover) {
            cover.style.display = "none"
            cover.setAttribute("aria-hidden", "true")
            document.body.style.pointerEvents = "auto"
            document.body.style.removeProperty("padding-right")
          }
        } catch {}
        try {
          const limit = this.demoteBelowZValue
          document.querySelectorAll("body *").forEach(n => {
            const cs = getComputedStyle(n)
            const zi = parseInt(cs.zIndex, 10)
            if (!Number.isNaN(zi) && zi >= limit && (cs.position === "fixed" || cs.position === "sticky" || cs.position === "absolute")) {
              if (!n.dataset._notifDemoted) {
                n.dataset._notifDemoted = cs.zIndex
                n.style.zIndex = String(limit - 1)
              }
            }
          })
        } catch {}
      })

      // 閉じたら専用コンテナだけ片付け＆降格を元に戻す
      modalEl.addEventListener("hidden.bs.modal", () => {
        try { inst.dispose() } catch {}
        try { modalEl.remove() } catch {}
        try { container.innerHTML = "" } catch {}
        try {
          document.querySelectorAll("[data-_notif-demoted]").forEach(n => {
            const old = n.dataset._notifDemoted
            delete n.dataset._notifDemoted
            if (old) n.style.zIndex = old; else n.style.removeProperty("z-index")
          })
        } catch {}
      }, { once: true })

      try { console.log("[notif-badge] shown notifications-modal") } catch {}
    } catch (err) {
      console.error("[notif-badge] openModal failed:", err)
    } finally {
      this._opening = false
    }
  }

  // ===== 既存モーダルを hide() だけ行う（衝突回避） =====
  async _hideAnyOpenModals() {
    const opened = Array.from(document.querySelectorAll(".modal.show"))
    if (opened.length === 0) return
    await Promise.all(opened.map((m) => {
      return new Promise((resolve) => {
        try {
          const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
          m.addEventListener("hidden.bs.modal", () => resolve(), { once: true })
          inst.hide()
        } catch { resolve() }
      })
    }))
  }

  // ===== 指定要素の出現を待つ =====
  _waitForElementOrMutation(selector, root = document, timeout = 3000) {
    return new Promise((resolve) => {
      const direct = (root || document).querySelector(selector)
      if (direct) return resolve(direct)

      let done = false
      const finish = (el) => { if (!done) { done = true; try { obs.disconnect() } catch {} ; resolve(el) } }

      const obs = new MutationObserver(() => {
        const el = (root || document).querySelector(selector) || document.querySelector(selector)
        if (el) finish(el)
      })
      try {
        obs.observe(root || document.body, { childList: true, subtree: true })
      } catch (_) {
        try { obs.observe(document.body || document.documentElement, { childList: true, subtree: true }) } catch {}
      }

      setTimeout(() => finish(null), timeout)
    })
  }

  // ===== 通知専用だけ安全に閉じる（ナビ前/復帰） =====
  _hideNotificationsModalSafely() {
    const el = document.getElementById("notifications-modal")
    if (!el) return
    try {
      const inst = bootstrap.Modal.getInstance(el) || bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true, focus: false })
      if (inst && typeof inst.hide === "function") inst.hide()
    } catch {}
  }

  // ===== メニュー開閉（任意） =====
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
