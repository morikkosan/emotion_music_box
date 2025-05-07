// app/javascript/packs/application.js
console.log("JavaScript is loaded successfully!");

/* --------------------------------------------------
 * 基本ライブラリのセットアップ
 * --------------------------------------------------*/
import Rails from "@rails/ujs";
Rails.start();

import "@hotwired/turbo-rails";
import "./controllers";

import * as bootstrap from "bootstrap";
window.bootstrap = bootstrap;

/* --------------------------------------------------
 * カスタム JS（必要に応じてコメントアウト解除）
 * --------------------------------------------------*/
import "./custom/comments";
import "./custom/gages_test";
import "./custom/flash_messages";
// import "./custom/search_music";

/* --------------------------------------------------
 * Turbo Stream: modal-content が差し替えられた直後にモーダルを再表示
 * --------------------------------------------------*/
document.addEventListener("turbo:after-stream-render", (ev) => {
  if (
    ev.target instanceof Turbo.StreamElement &&
    ev.target.target === "modal-content"
  ) {
    const modal = document.getElementById("modal-container");
    if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();
  }
});

/* --------------------------------------------------
 * Turbo が完全にロードされた後の初期化
 * --------------------------------------------------*/
document.addEventListener("turbo:load", () => {
  console.log("✅ Turbo loaded OK");

  // 例: 検索ボタンにクリックイベントを付与（重複登録防止）
  const button = document.getElementById("search-button");
  if (button && button.dataset.listenerAdded !== "true") {
    button.addEventListener("click", searchMusicWithPagination);
    button.dataset.listenerAdded = "true";
  }
});
