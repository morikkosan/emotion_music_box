import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["icon", "count"]

  connect() {
    // turbo:frame-load イベントをリッスンしてターゲットが正しく読み込まれたことを確認
    this.element.addEventListener("turbo:frame-load", () => {
      console.log("Turbo frame loaded, targets are available.");
    });
  }

  toggle(event) {
    console.log("📌 toggle() 発火");

    const toggled = this.iconTarget.dataset.toggled === "true";
    console.log("🔄 現在の状態:", toggled ? "bookmarked" : "unbookmarked");

    const newIconSrc = toggled
      ? this.iconTarget.dataset.unbookmarkedUrl
      : this.iconTarget.dataset.bookmarkedUrl;
    console.log("🖼️ 切り替える画像パス:", newIconSrc);

    this.iconTarget.src = "";
    this.iconTarget.src = newIconSrc;

    this.iconTarget.dataset.toggled = toggled ? "false" : "true";
    console.log("✅ 新しい状態:", this.iconTarget.dataset.toggled);

    const count = parseInt(this.countTarget.innerText);
    const newCount = toggled ? count - 1 : count + 1;
    this.countTarget.innerText = newCount;

    console.log("🔢 カウント更新:", count, "→", newCount);
  }
}
