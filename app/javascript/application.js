// app/javascript/packs/application.js
console.log("JavaScript is loaded successfully!");

import Rails from "@rails/ujs";
Rails.start();

import "@hotwired/turbo-rails";
import "./controllers";

import * as bootstrap from "bootstrap";
window.bootstrap = bootstrap;

import "./custom/comments";
import "./custom/gages_test";
import "./custom/flash_messages";
// 検索ロジックを使うならこちらをコメントアウト解除
// import "./custom/search_music";

// -------------------------------------------------------------
// ここからトップレベルで一度だけ登録する
// Turbo Stream で modal-content が差し替えられたあとにモーダルを表示
document.addEventListener("turbo:after-stream-render", (event) => {
  const turboStreamEl = event.detail.newStreamElement;
  if (turboStreamEl.getAttribute("target") === "modal-content") {
    const modalContainer = document.getElementById("modal-container");
    if (modalContainer) {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalContainer);
      modalInstance.show();
    }
  }
});
// -------------------------------------------------------------

// 全体共通の初期化（検索ボタンの監視もここでOK）
document.addEventListener("turbo:load", () => {
  console.log("✅ Turbo loaded OK");

  const button = document.getElementById("search-button");
  if (button && button.dataset.listenerAdded !== "true") {
    button.addEventListener("click", searchMusicWithPagination);
    button.dataset.listenerAdded = "true";
  }
});
