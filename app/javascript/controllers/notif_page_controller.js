// app/javascript/controllers/notif_page_controller.js
import { Controller } from "@hotwired/stimulus"

/**
 * 1つのコントローラで3役を担当します。
 * - role="index" : 通知一覧ページ。@just_marked_all_read が true のときバッジ更新を1回発火
 * - role="modal" : Turbo Streamで差し込まれた通知モーダルを表示し、hiddenで破棄＆コンテナ掃除
 * - role="page"  : モーダル内の通知ページ（Turbo Frame）。差し替え毎にバッジ更新を1回発火
 *
 * 各ビューで data-* を付けて役割を切り替えます（下にサンプルあり）。
 */
export default class extends Controller {
  static values = {
    role: String,                 // "index" | "modal" | "page"
    justMarked: Boolean,          // index 用（@just_marked_all_read）
    currentPage: Number,          // page 用（現在ページ番号）
    modalContainerId: String      // modal 用（掃除対象のコンテナID、例: "notifications-modal-container"）
  }

  connect() {
    switch (this.roleValue) {
      case "index":
        this.onIndexConnect()
        break
      case "modal":
        this.onModalConnect()
        break
      case "page":
      default:
        this.onPageConnect()
        break
    }
  }

  // ===== role: index =====
  onIndexConnect() {
    if (this.hasJustMarkedValue && this.justMarkedValue) {
      window.dispatchEvent(new CustomEvent("notifications:refresh-badge", {
        detail: { source: "index" }
      }))
    }
  }

  // ===== role: modal =====
  onModalConnect() {
    const el = this.element
    const bootstrap = window.bootstrap
    if (!el || !bootstrap || !bootstrap.Modal) return

    const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true })
    modal.show()

    const onHidden = () => {
      try { modal.dispose() } catch (_) {}
      el.removeEventListener("hidden.bs.modal", onHidden)
      const cid = this.hasModalContainerIdValue ? this.modalContainerIdValue : "notifications-modal-container"
      const c = document.getElementById(cid)
      if (c) c.innerHTML = ""
    }
    el.addEventListener("hidden.bs.modal", onHidden)
  }

  // ===== role: page =====
  onPageConnect() {
    const page = this.hasCurrentPageValue ? this.currentPageValue : undefined
    window.dispatchEvent(new CustomEvent("notifications:refresh-badge", {
      detail: { source: "modal_page", page }
    }))
  }
}
