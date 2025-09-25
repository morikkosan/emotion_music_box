// app/javascript/application.js
import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";

// 既存
import "./controllers";
import "./custom/comments";
import "./custom/flash_messages";
import "./custom/gages_test";
import "./custom/inline_handlers";
import "./custom/swal_my_create";
import { registerServiceWorker } from "./custom/register_service_worker";

// 分割した副作用モジュール（全部 custom 直下）
import "./custom/push_once";
import "./custom/turbo_loader";
import "./custom/modal_guards";
import "./custom/record_modal_patch";
import "./custom/modal_content_observer";
import "./custom/screen_cover";
import "./custom/hp_date_init";
import "./custom/recommend_button";
import "./custom/avatar_cropper";
import "./custom/recommended_global";

// ★ 追加：共通オーバーレイクリーンアップ
import { runGlobalOverlayCleanup } from "./custom/overlay_cleanup.js";

Rails.start();
console.log("🔥 Rails UJS is loaded!", Rails);
window.bootstrap = bootstrap;

// ★ 任意：他スクリプトから呼べるように公開
if (!window.runGlobalOverlayCleanup) {
  window.runGlobalOverlayCleanup = runGlobalOverlayCleanup;
}

// ★ 多重登録防止しつつ、復元/描画ごとに必ず掃除するリスナーを一括登録
if (!window.__overlayCleanupInitialized) {
  window.__overlayCleanupInitialized = true;

  const safeCleanup = () => {
    try { runGlobalOverlayCleanup(); } catch (_) {}
  };

  document.addEventListener("turbo:before-cache", safeCleanup);
  document.addEventListener("turbo:render",       safeCleanup);
  document.addEventListener("turbo:load",         safeCleanup);
  window.addEventListener("pageshow",             safeCleanup);
}

// サービスワーカー登録（従来どおり）
registerServiceWorker();
