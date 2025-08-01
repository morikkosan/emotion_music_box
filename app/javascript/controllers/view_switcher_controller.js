import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    console.log("[view-switcher] connect!!");
    this._switchViewBound = this.switchView.bind(this);
    this.switchView();
    window.addEventListener("resize", this._switchViewBound);
  }

  disconnect() {
    console.log("[view-switcher] disconnect!!");
    window.removeEventListener("resize", this._switchViewBound);
  }

  switchView() {
    const width = window.innerWidth;
    console.log("[view-switcher] switchView called! 幅:", width);
    const isMobile = width <= 996;
    console.log("[view-switcher] isMobile:", isMobile);

    const path = window.location.pathname;
    console.log("[view-switcher] path:", path);

    const isOnTargetPage = [
      "/", "/emotion_logs", "/emotion_logs/", "/emotion_logs/index", "/my_emotion_logs", "/bookmarks/emotion_logs", "/recommended"
    ].some(prefix => path.startsWith(prefix));
    console.log("[view-switcher] isOnTargetPage:", isOnTargetPage);

    const desktopView = document.getElementById("desktop-view");
    const mobileView  = document.getElementById("mobile-view");
    console.log("[view-switcher] desktopView:", desktopView);
    console.log("[view-switcher] mobileView:", mobileView);

    if (!isOnTargetPage || !desktopView || !mobileView) {
      console.log("[view-switcher] Not target page or missing elements");
      if (desktopView) {
        console.log("[view-switcher] desktopView: remove view-hidden");
        desktopView.classList.remove("view-hidden");
      }
      if (mobileView) {
        console.log("[view-switcher] mobileView: add view-hidden");
        mobileView.classList.add("view-hidden");
      }
      return;
    }

    if (isMobile) {
      console.log("[view-switcher] → MOBILE表示");
      desktopView.classList.add("view-hidden");
      mobileView.classList.remove("view-hidden");
    } else {
      console.log("[view-switcher] → DESKTOP表示");
      desktopView.classList.remove("view-hidden");
      mobileView.classList.add("view-hidden");
    }
  }
}
