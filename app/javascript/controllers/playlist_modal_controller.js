// app/javascript/controllers/playlist_modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"
// ★ 追加：共通クリーンアップのインポート
import { runGlobalOverlayCleanup } from "../custom/overlay_cleanup.js";

/**
 * ✅ 共通の「プレイリスト選択リセット」関数
 * - PC/モバイル共通で:
 *   - .playlist-check を全部OFF
 *   - selection-counter の「選択クリア」を実行
 *
 * 👉 実質「選択クリアボタンを押したのと同じ」動作をここにまとめる
 */
function resetPlaylistSelection() {
  try {
    // 1. チェックされているプレイリスト用チェックボックスを全部OFFにする
    document.querySelectorAll("input.playlist-check:checked").forEach((cb) => {
      cb.checked = false
      // selection-counter が change を拾って再計算できるように change を飛ばす
      cb.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // 2. selection-counter の「選択クリア」ボタンをクリックして
    //    「○個選択中」も0に戻す（PC・モバイル両方に効く）
    document
      .querySelectorAll("[data-action*='selection-counter#clearAll']")
      .forEach((btn) => {
        try { btn.click() } catch (_) {}
      })
  } catch (e) {
    console.warn("[playlist-modal] resetPlaylistSelection error:", e)
  }
}

/**
 * 「ページ常設のプレイリストモーダル」用
 * ・DOMはremoveしない（使い回し）
 * ・開く前に他モーダルの残骸を掃除
 * ・Turboとの相性ケア（フラッシュは“描画後”に必ず起動）
 */
export default class extends Controller {
  static values = { modalId: String }

  connect() {
    this.modalEl = document.getElementById(this.modalIdValue || "playlist-modal")
    if (!this.modalEl) {
      console.warn("[playlist-modal] 対象モーダル要素が見つかりません:", this.modalIdValue)
      return
    }
    this.#cleanupBackdropsAndBody()

    // ✅ モーダルが閉じられたときに「選択状態」もリセットする
    this._onHidden = () => {
      try {
        bootstrap.Modal.getInstance(this.modalEl)?.dispose()
      } catch (_) {}
      this.#cleanupBackdropsAndBody()

      // ★ ここで必ず「チェックと個数表示」をリセット
      resetPlaylistSelection()
    }

    this.modalEl.addEventListener("hidden.bs.modal", this._onHidden)
  }

  disconnect() {
    if (this.modalEl) {
      this.modalEl.removeEventListener?.("hidden.bs.modal", this._onHidden)
      try { bootstrap.Modal.getInstance(this.modalEl)?.dispose() } catch (_) {}
    }
    this.#cleanupBackdropsAndBody()
  }

  open(event) {
    if (event) event.preventDefault()
    this.modalEl = document.getElementById(this.modalIdValue || "playlist-modal")
    if (!this.modalEl) return

    this.#closeAllModals()
    this.#cleanupBackdropsAndBody()

    const bs = bootstrap.Modal.getOrCreateInstance(this.modalEl, {
      backdrop: true,
      focus: true,
      keyboard: true,
    })
    bs.show()

    // 📌 開くときに、チェック済みのログを hidden フィールドとしてモーダル内にコピー
    setTimeout(() => {
      const container = this.modalEl.querySelector("#selected-log-ids")
      if (!container) return
      container.innerHTML = ""
      document.querySelectorAll("input.playlist-check:checked").forEach((cb) => {
        const hidden = document.createElement("input")
        hidden.type = "hidden"
        hidden.name = "selected_logs[]"
        hidden.value = cb.value
        container.appendChild(hidden)
      })
    }, 50)
  }

  close(event) {
    if (event) event.preventDefault()
    if (!this.modalEl) return
    const inst =
      bootstrap.Modal.getInstance(this.modalEl) ||
      bootstrap.Modal.getOrCreateInstance(this.modalEl)
    inst.hide()
  }

  #closeAllModals() {
    document.querySelectorAll(".modal.show").forEach((m) => {
      try {
        const inst =
          bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
        inst.hide()
        inst.dispose()
      } catch (_) {}
      m.classList.remove("show")
      m.style.display = ""
      m.removeAttribute("aria-modal")
      m.setAttribute("aria-hidden", "true")
    })
  }

  #cleanupBackdropsAndBody() {
    document
      .querySelectorAll(".modal-backdrop, .offcanvas-backdrop")
      .forEach((el) => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""
    document.body.style.paddingRight = ""
    this.#cleanupSwalArtifacts()
    document.body.style.pointerEvents = "auto"
  }

  #cleanupSwalArtifacts() {
    const selectors = [
      "#swal-fake-modal",
      ".sweet-overlay",
      "#sweet-alert",
      ".swal2-container",
      ".swal2-backdrop",
    ]
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((n) => {
        try {
          n.remove()
        } catch (_) {
          n.style.pointerEvents = "none"
          n.style.display = "none"
          n.style.visibility = "hidden"
        }
      })
    })
    document.body.classList.remove("swal2-shown")
  }
}

/* ==== Turbo連携 ==== */

// ✅ これ（before-stream-render 上書き）はこのコントローラに必要なので残す
document.addEventListener("turbo:before-stream-render", (event) => {
  const stream = event.target
  if (!stream || stream.tagName !== "TURBO-STREAM") {
    runGlobalOverlayCleanup()
    return
  }
  const tpl = stream.querySelector("template")
  const html = (tpl ? tpl.innerHTML : stream.innerHTML) || ""
  const targetAttr = (stream.getAttribute("target") || "").toLowerCase()
  const touchesFlash =
    /id="flash-container"/i.test(html) ||
    /data-flash-notice|data-flash-alert/i.test(html) ||
    targetAttr === "flash" ||
    targetAttr === "modal-container"

  if (!touchesFlash) {
    runGlobalOverlayCleanup()
  }

  const orig = event.detail && event.detail.render
  if (typeof orig === "function") {
    event.detail.render = (target) => {
      orig(target)
      if (touchesFlash) {
        queueMicrotask(() => {
          try {
            if (typeof window.showFlashMessages === "function") {
              window.showFlashMessages()
            } else if (typeof window.showFlashSwal === "function") {
              window.showFlashSwal()
            }
          } catch (_) {}

          try {
            const fc = document.getElementById("flash-container")
            const notice = (fc?.getAttribute("data-flash-notice") || "")
            if (/プレイリストを作成しました/.test(notice)) {
              // ▶ プレイリスト名の入力欄リセット
              document
                .querySelectorAll('input[name="playlist[name]"]')
                .forEach((el) => {
                  el.value = ""
                  el.dispatchEvent(new Event("input", { bubbles: true }))
                  el.dispatchEvent(new Event("change", { bubbles: true }))
                })

              // ▶ チェック状態と選択数もリセット（PC/モバイル共通）
              resetPlaylistSelection()
            }
          } catch (_) {}
        })
      }
    }
  }
})

/**
 * ✅ ここが今回の「決め手」
 *
 * Turboのフォーム送信完了イベント（turbo:submit-end）をグローバルに拾って、
 * 「playlists に対するフォーム送信が成功した」ときだけ
 * resetPlaylistSelection() を実行する。
 *
 * → 実質「プレイリスト作成完了 ＝ 選択クリアボタンを押したのと同じ」
 */
document.addEventListener("turbo:submit-end", (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return

  const detail = event.detail || {}
  // 送信が失敗しているとき（バリデーションエラー等）は何もしない
  if (detail.success === false) return

  const action = form.getAttribute("action") || ""

  // 🎯 playlists に対するフォーム（作成/更新）だけを対象にする
  if (!/playlists/.test(action)) return

  // ✅ プレイリスト作成成功 → チェック＆カウンタをリセット
  resetPlaylistSelection()
})
