import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["icon", "count"]

  connect() {
    // Turbo Frame が読み込まれたら console に通知（開発用デバッグ）
    this.element.addEventListener("turbo:frame-load", () => {
      //console.log("Turbo frame loaded, targets are available.");
    });
  }

  toggle(_event) {
    //console.log("📌 toggle() 発火");

    // 現在の状態を取得（"true" or "false"）
    const isBookmarked = this.iconTarget.dataset.toggled === "true";
    //console.log("🔄 現在の状態:", isBookmarked ? "bookmarked" : "unbookmarked");

    // 切り替える画像 URL を設定
    const newIconSrc = isBookmarked
      ? this.iconTarget.dataset.unbookmarkedUrl
      : this.iconTarget.dataset.bookmarkedUrl;
    //console.log("🖼️ 切り替える画像パス:", newIconSrc);

    // アイコン画像を更新
    this.iconTarget.src = ""; // 一旦リセット（ブラウザキャッシュ回避）
    this.iconTarget.src = newIconSrc;

    // toggled 状態を切り替え
    this.iconTarget.dataset.toggled = isBookmarked ? "false" : "true";
    //console.log("✅ 新しい状態:", this.iconTarget.dataset.toggled);

    // ブックマーク数を更新
    const currentCount = parseInt(this.countTarget.innerText, 10);
    const updatedCount = isBookmarked ? currentCount - 1 : currentCount + 1;
    this.countTarget.innerText = updatedCount;

    //console.log("🔢 カウント更新:", currentCount, "→", updatedCount);
  }
}
