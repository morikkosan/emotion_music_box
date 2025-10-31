// app/javascript/controllers/notif_badge_controller.js
import { Controller } from "@hotwired/stimulus"

/**
 * 使い方（既に組み込み済みの想定）:
 * <div
 *   data-controller="notif-badge"
 *   data-notif-badge-endpoint-value="/notifications/unread_count.json"
 *   data-notif-badge-poll-interval-value="30000">
 *   <span class="notif-count-badge" data-notif-badge-target="badge" hidden>0</span>
 *   <a href="/notifications">通知数</a>
 * </div>
 */
export default class extends Controller {
  static targets = ["badge"]
  static values = {
    endpoint: String,
    pollInterval: { type: Number, default: 30000 },
    // 画面が非表示の間はポーリングを止める（通信量節約）
    pauseOnHidden: { type: Boolean, default: true }
  }

  connect() {
    // バインド（removeEventListenerできるように）
    this._boundRefresh = this.refresh.bind(this)
    this._boundOnVisibility = this.onVisibilityChange.bind(this)
    this._boundOnTurboLoad = this.onTurboLoad.bind(this)
    this._boundOnTurboFrameLoad = this.onTurboLoad.bind(this)

    // 外部からの更新要求（既読化後に index ビューが dispatch するやつ）
    window.addEventListener("notifications:refresh-badge", this._boundRefresh)

    // タブ可視状態の変化でポーリングを止めたり再開したり
    document.addEventListener("visibilitychange", this._boundOnVisibility)

    // Turbo遷移（ページ/フレーム）が完了したら即更新
    window.addEventListener("turbo:load", this._boundOnTurboLoad)
    window.addEventListener("turbo:frame-load", this._boundOnTurboFrameLoad)

    // 競合する連続 fetch を抑止するためのフラグ
    this._inFlight = false

    // 初回即時更新
    this.update()

    // ポーリング開始
    this.startTimer()
  }

  disconnect() {
    window.removeEventListener("notifications:refresh-badge", this._boundRefresh)
    document.removeEventListener("visibilitychange", this._boundOnVisibility)
    window.removeEventListener("turbo:load", this._boundOnTurboLoad)
    window.removeEventListener("turbo:frame-load", this._boundOnTurboFrameLoad)
    this.clearTimer()
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
      // バックグラウンドに入ったら停止（節約）
      if (this.pauseOnHiddenValue) this.clearTimer()
    } else {
      // 表示に戻ったら即更新 → タイマー再開
      this.update()
      this.startTimer()
    }
  }

  onTurboLoad() {
    // Turbo遷移完了後に最新件数へ
    this.update()
  }

  // ===== 外部イベント/手動の更新要求 =====
  refresh() {
    this.update()
  }

  // ===== 件数取得 & レンダリング =====
  async update() {
    if (!this.endpointValue || typeof this.endpointValue !== "string") {
      // endpoint が未設定なら何もしない（安全側）
      return
    }
    if (this._inFlight) {
      // 連打やポーリング競合時はスキップ
      return
    }

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
      // 失敗時はバッジ非表示にしておく（ログは控えめに）
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
}
