// app/javascript/controllers/playlist_modal_controller.js
import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

/**
 * これは「ページ常設のプレイリストモーダル」専用コントローラ。
 * ・DOMを remove しない（毎回使い回す）
 * ・開く前に他のモーダル/バックドロップの残骸を掃除
 * ・Turbo遷移前後の掃除も実施
 *
 * 使い方（例）:
 * <div data-controller="playlist-modal"
 *      data-playlist-modal-id-value="playlist-modal-mobile">
 *   <button data-action="click->playlist-modal#open">プレイリスト</button>
 * </div>
 * ...
 * <div id="playlist-modal-mobile" class="modal" tabindex="-1">...</div>
 */

export default class extends Controller {
  static values = {
    // 開く対象のモーダル要素ID（例: "playlist-modal-mobile"）
    modalId: String
  }

  connect() {
    // 対象モーダル要素を取得
    this.modalEl = document.getElementById(this.modalIdValue || "playlist-modal")
    if (!this.modalEl) {
      console.warn("[playlist-modal] 対象モーダル要素が見つかりません:", this.modalIdValue)
      return
    }

    // 念のため残骸掃除（初回接続時）
    this.#cleanupBackdropsAndBody()

    // hidden 時に後片付け（disposeしてもDOMは残す）
    this._onHidden = () => {
      try {
        const inst = bootstrap.Modal.getInstance(this.modalEl)
        inst?.dispose()
      } catch (_) {}
      this.#cleanupBackdropsAndBody()
      // ★ 常設なので DOM は消さない（remove しない）
    }
    this.modalEl.addEventListener("hidden.bs.modal", this._onHidden)
  }

  disconnect() {
    if (this.modalEl) {
      this.modalEl.removeEventListener?.("hidden.bs.modal", this._onHidden)
      try {
        const inst = bootstrap.Modal.getInstance(this.modalEl)
        inst?.dispose()
      } catch (_) {}
    }
    this.#cleanupBackdropsAndBody()
  }

  // 外部ボタンから呼ぶ
  open(event) {
    if (event) event.preventDefault()

    if (!this.modalEl) {
      console.warn("[playlist-modal] modalEl が未定義です")
      return
    }

    // ほかのモーダルを全部閉じて dispose → 残骸掃除
    this.#closeAllModals()
    this.#cleanupBackdropsAndBody()

    // 自分を開く
    const bs = bootstrap.Modal.getOrCreateInstance(this.modalEl, {
      backdrop: true,
      focus: true,
      keyboard: true,
    })
    bs.show()

    // 必要なら、チェックされたログIDを hidden で流し込む（任意）
    // #selected-log-ids がモーダル内にあるときのみ実行
    setTimeout(() => {
      const selectedLogContainer = this.modalEl.querySelector("#selected-log-ids")
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
    }, 50)
  }

  // 任意：外部から閉じたいとき
  close(event) {
    if (event) event.preventDefault()
    if (!this.modalEl) return
    const inst = bootstrap.Modal.getInstance(this.modalEl) || bootstrap.Modal.getOrCreateInstance(this.modalEl)
    inst.hide()
  }

  // ==== 内部ユーティリティ ====

  #closeAllModals() {
    document.querySelectorAll(".modal.show").forEach(m => {
      try {
        const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
        inst.hide()
        inst.dispose()
      } catch (_) {}
      // 念のためDOM状態も初期化
      m.classList.remove("show")
      m.style.display = ""
      m.removeAttribute("aria-modal")
      m.setAttribute("aria-hidden", "true")
    })
  }

  #cleanupBackdropsAndBody() {
    // Bootstrap / Offcanvas の残骸
    document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(el => el.remove())
    document.body.classList.remove("modal-open")
    document.body.style.overflow = ""
    document.body.style.paddingRight = ""

    // ★ SweetAlert / SweetAlert2 などの“偽モーダル”も掃除
    this.#cleanupSwalArtifacts()

    // 念のため pointer-events を回復
    document.body.style.pointerEvents = "auto"
  }

  #cleanupSwalArtifacts() {
    const selectors = [
      "#swal-fake-modal",   // ← あなたの環境で実際に残っていた犯人
      ".sweet-overlay",     // bootstrap-sweetalert
      "#sweet-alert",       // 古い sweetalert
      ".swal2-container",   // sweetalert2
      ".swal2-backdrop"
    ]
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(n => {
        try { n.remove() } catch (_) {
          n.style.pointerEvents = "none"
          n.style.display = "none"
          n.style.visibility = "hidden"
        }
      })
    })
    document.body.classList.remove("swal2-shown")
  }
}

/* ==== Turboの前処理（残骸掃除） ==== */
function runGlobalOverlayCleanup() {
  // すべての .modal を閉じて初期化
  document.querySelectorAll(".modal.show").forEach(m => {
    try {
      const inst = bootstrap.Modal.getInstance(m) || bootstrap.Modal.getOrCreateInstance(m)
      inst.hide(); inst.dispose()
    } catch (_) {}
    m.classList.remove("show")
    m.style.display = ""
    m.removeAttribute("aria-modal")
    m.setAttribute("aria-hidden", "true")
  })

  // backdrop / body の復旧
  document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(el => el.remove())
  document.body.classList.remove("modal-open")
  document.body.style.overflow = ""
  document.body.style.paddingRight = ""

  // SweetAlert 系の“偽モーダル”除去
  ;["#swal-fake-modal", ".sweet-overlay", "#sweet-alert", ".swal2-container", ".swal2-backdrop"].forEach(sel => {
    document.querySelectorAll(sel).forEach(n => {
      try { n.remove() } catch (_) {
        n.style.pointerEvents = "none"
        n.style.display = "none"
        n.style.visibility = "hidden"
      }
    })
  })
  document.body.classList.remove("swal2-shown")
  document.body.style.pointerEvents = "auto"
}

document.addEventListener("turbo:before-cache", () => {
  runGlobalOverlayCleanup()
})

document.addEventListener("turbo:before-stream-render", () => {
  runGlobalOverlayCleanup()
})
