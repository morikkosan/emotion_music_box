import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    console.log("[view-switcher] connect!!");
    this._switchViewBound = this.switchView.bind(this);
    this.switchView();
    window.addEventListener("resize", this._switchViewBound);

    // 初回にアクティブフッター判定
    this.highlightActiveFooter();
    window.addEventListener("popstate", this.highlightActiveFooter.bind(this));
  }

  disconnect() {
    console.log("[view-switcher] disconnect!!");
    window.removeEventListener("resize", this._switchViewBound);
    window.removeEventListener("popstate", this.highlightActiveFooter.bind(this));
  }

  switchView() {
    const width = window.innerWidth;
    const isMobile = width <= 996;
    const path = window.location.pathname;

    // 対象ページ判定
    const isOnTargetPage = [
      "/", "/emotion_logs", "/emotion_logs/", "/emotion_logs/index",
      "/my_emotion_logs", "/emotion_logs/bookmarks", "/recommended"
    ].some(prefix => path.startsWith(prefix));

    const desktopView = document.getElementById("desktop-view");
    const mobileView  = document.getElementById("mobile-view");

    // --- ここだけリロード許可（デスクトップお気に入り→スマホindex） ---
    if (
      isMobile &&
      path === "/emotion_logs/bookmarks"
    ) {
      window.location.replace("/emotion_logs");
      return;
    }

    if (!isOnTargetPage || !desktopView || !mobileView) {
      if (desktopView) {
        desktopView.classList.remove("view-hidden");
      }
      if (mobileView) {
        mobileView.classList.add("view-hidden");
      }
      return;
    }

    if (isMobile) {
      desktopView.classList.add("view-hidden");
      mobileView.classList.remove("view-hidden");
    } else {
      desktopView.classList.remove("view-hidden");
      mobileView.classList.add("view-hidden");
    }

    // ページ切り替え時も判定
    this.highlightActiveFooter();
  }

  // ▼ ここから追加
  highlightActiveFooter() {
    // 一度すべてのactiveクラスを消す
    document.querySelectorAll(".mobile-footer .text-center.text-white.small").forEach(el => {
      el.classList.remove("active");
    });

    // 現在のパスに応じてactiveを付与
    const path = window.location.pathname;
    // ホーム
    if (path === "/" || path === "/emotion_logs" || path === "/emotion_logs/") {
      document.querySelectorAll(".mobile-footer .bi-house").forEach(icon => {
        icon.parentElement.classList.add("active");
      });
    }
    // マイページ
    if (path === "/my_emotion_logs") {
      document.querySelectorAll(".mobile-footer .bi-person").forEach(icon => {
        icon.parentElement.classList.add("active");
      });
    }
    // お気に入り
    if (path === "/emotion_logs/bookmarks") {
      document.querySelectorAll(".mobile-footer .bi-heart").forEach(icon => {
        icon.parentElement.classList.add("active");
      });
    }
    // 検索やプレイリスト（modal表示などはparamsで判断してJSで付けてもOK）
    // おすすめ
    if (path === "/recommended") {
      document.querySelectorAll(".mobile-footer .bi-fire").forEach(icon => {
        icon.parentElement.classList.add("active");
      });
    }
    // 必要なら paramsやmodalでの判定も追加
  }
}
