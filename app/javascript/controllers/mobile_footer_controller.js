// app/javascript/controllers/mobile_footer_controller.js
import { Controller } from "@hotwired/stimulus";

/**
 * モバイル下部メニューの active 制御
 * - クリック時に即時で active を付与
 * - Turbo Frame の部分遷移完了後（URL更新後）にも現在URLから復元
 * - 検索・プレイリスト（モーダル）はクリック時のみ点灯、遷移後にURL基準で再計算
 */
export default class extends Controller {
  static targets = ["item"];

  connect() {
    // Turboのイベント購読（frame-load: フレームの置き換え完了 / load: ページ遷移完了）
    this.onFrameLoadBound = this.onFrameLoad.bind(this);
    this.onTurboLoadBound = this.updateActiveFromURL.bind(this);

    document.addEventListener("turbo:frame-load", this.onFrameLoadBound);
    document.addEventListener("turbo:load", this.onTurboLoadBound);

    // 初期表示時にURLから反映
    this.updateActiveFromURL();
  }

  disconnect() {
    document.removeEventListener("turbo:frame-load", this.onFrameLoadBound);
    document.removeEventListener("turbo:load", this.onTurboLoadBound);
  }

  // 任意のフッター項目クリック時（Aタグ/ボタン共通）
  onClick(event) {
    const el = event.currentTarget;
    this.setActiveElement(el);
  }

  // 検索（モーダル）
  onSearchClick(event) {
    const el = event.currentTarget;
    this.setActiveElement(el); // 一時的に点灯
  }

  // プレイリスト（モーダル）
  onPlaylistClick(event) {
    const el = event.currentTarget;
    this.setActiveElement(el); // 一時的に点灯
  }

  // 指定フレーム（logs_list_mobile）が読み込まれたらURLに基づき再計算
  onFrameLoad(e) {
    if (e.target && e.target.id === "logs_list_mobile") {
      this.updateActiveFromURL();
    }
  }

  // 現在URLからアクティブを復元（Aタグのhrefのpathnameと一致で判定）
  updateActiveFromURL() {
    const currentPath = window.location.pathname;

    // まず全解除
    this.clearAllActive();

    // href を持つターゲットから最良一致（pathname一致）を探す
    let matched = false;
    this.itemTargets.forEach((el) => {
      const href = this._resolveHref(el);
      if (!href) return;
      const linkPath = new URL(href, window.location.origin).pathname;
      if (linkPath === currentPath) {
        this._applyActive(el);
        matched = true;
      }
    });

    // /emotion_logs 系で一致がなければホームを点灯
    if (!matched && currentPath.startsWith("/emotion_logs")) {
      const home = this.itemTargets.find(
        (el) => (el.dataset.section || "").toLowerCase() === "home"
      );
      if (home) this._applyActive(home);
    }
  }

  setActiveElement(el) {
    this.clearAllActive();
    this._applyActive(el);
  }

  clearAllActive() {
    this.itemTargets.forEach((el) => {
      el.classList.remove("active");
      el.removeAttribute("aria-current");
    });
  }

  _applyActive(el) {
    el.classList.add("active");
    el.setAttribute("aria-current", "page");
  }

  _resolveHref(el) {
    // Aタグならそのhref、ボタンなら data-href（必要なら付与）
    if (el.tagName === "A") return el.getAttribute("href");
    return el.dataset.href || null;
  }
}
