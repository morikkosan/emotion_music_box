import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    console.log("🟢 view-switcher 起動");

    this.boundHandler = this.checkAndRedirect.bind(this);

    this.checkAndRedirect();
    window.addEventListener("resize", this.boundHandler);
  }

  disconnect() {
    window.removeEventListener("resize", this.boundHandler);
  }

  checkAndRedirect() {
    const width = window.innerWidth;
    const isNarrow = width <= 600;
    const path = window.location.pathname;
    const url = new URL(window.location.href);
    const isAlreadyMobile = url.searchParams.get("view") === "mobile";

  const isOnTargetPage = [
    "/",
    "/emotion_logs",
    "/emotion_logs/", 
    "/emotion_logs/index", 
    "/my_emotion_logs",
    "/bookmarks/emotion_logs",
    "/recommended"
  ].some(prefix => path.startsWith(prefix));


    console.log("📏 幅:", width);
    console.log("✅ isNarrow（600以下）:", isNarrow);
    console.log("✅ isOnTargetPage:", isOnTargetPage);
    console.log("✅ isAlreadyMobile（view=mobile）:", isAlreadyMobile);

    if (isNarrow && isOnTargetPage && !isAlreadyMobile) {
      console.log("📱 モバイルに切替");
      url.searchParams.set("view", "mobile");
      window.location.href = url.toString();
    } else if (!isNarrow && isOnTargetPage && isAlreadyMobile) {
      console.log("💻 デスクトップに戻す");
      url.searchParams.delete("view");
      window.location.href = url.pathname; // クエリなしで再読み込み
    } else {
      console.log("🛑 条件を満たさないので何もしない");
    }
  }
}

