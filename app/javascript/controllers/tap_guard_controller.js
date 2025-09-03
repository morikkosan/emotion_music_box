// スマホの指ズレで怒るクリック扱いになってしまうのを対策する　コントローラー

// app/javascript/controllers/tap_guard_controller.js
import { Controller } from "@hotwired/stimulus";

/**
 * タップとスワイプを判定するガード。
 * - 指の移動距離が threshold を超えたら「ドラッグ扱い」とし、クリック（遷移）を抑止。
 * - iOSの「ゴーストクリック」対策として、touchend後400msはクリックを無視。
 *
 * 使い方（リンクやボタンに付与）：
 *   data-controller="tap-guard"
 *   data-action="
 *     touchstart->tap-guard#start
 *     touchmove->tap-guard#move
 *     touchend->tap-guard#end
 *     click->tap-guard#click
 *   "
 *   data-tap-guard-threshold-value="14"  // 任意（px）。省略時14px
 */
export default class extends Controller {
  static values = {
    threshold: { type: Number, default: 14 },
  };

  connect() {
    this._dragging = false;
    this._startX = 0;
    this._startY = 0;
    this._suppressClickUntil = 0;
  }

  start(e) {
    const t = e.touches?.[0];
    if (!t) return;
    this._dragging = false;
    this._startX = t.clientX;
    this._startY = t.clientY;
  }

  move(e) {
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - this._startX;
    const dy = t.clientY - this._startY;
    if (Math.hypot(dx, dy) > this.thresholdValue) {
      this._dragging = true;
    }
  }

  end(e) {
    if (this._dragging) {
      // 直後のゴーストクリックも殺す
      this._suppressClickUntil = performance.now() + 400;
      e.preventDefault();
      e.stopPropagation();
      this._dragging = false;
    }
  }

  click(e) {
    if (this._dragging || performance.now() < this._suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      this._dragging = false;
      return false;
    }
  }
}
